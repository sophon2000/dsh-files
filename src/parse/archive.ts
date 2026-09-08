import yauzl from 'yauzl'
import type { ParseLimits } from './limits.ts'

// Mature ZIP reader, lazy central-directory traversal and streamed validation.
// No files are extracted. Count actual inflated bytes, not just metadata claims.
export async function checkArchive(bytes: Uint8Array, limits: ParseLimits): Promise<void> {
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.fromBuffer(Buffer.from(bytes), { lazyEntries: true, autoClose: false, validateEntrySizes: true },
      (error, value) => error ? reject(error) : resolve(value!))
  })
  try {
    await new Promise<void>((resolve, reject) => {
      let count = 0
      let declared = 0
      let expanded = 0
      const names = new Set<string>()
      zip.on('error', reject)
      zip.on('end', resolve)
      zip.on('entry', (entry: yauzl.Entry) => {
        void (async () => {
          count++
          declared += entry.uncompressedSize
          if (count > limits.maxArchiveEntries || declared > limits.maxExpandedBytes ||
              entry.uncompressedSize > Math.max(1, entry.compressedSize) * limits.maxCompressionRatio) {
            throw new Error('document archive exceeds expansion budget')
          }
          if ((entry.generalPurposeBitFlag & 1) !== 0 || names.has(entry.fileName)) {
            throw new Error('encrypted or duplicate archive entries are unsupported')
          }
          names.add(entry.fileName)
          const stream = await new Promise<NodeJS.ReadableStream>((res, rej) => {
            zip.openReadStream(entry, (error, value) => error ? rej(error) : res(value!))
          })
          for await (const chunk of stream) {
            expanded += (chunk as Buffer).length
            if (expanded > limits.maxExpandedBytes) throw new Error('document archive exceeds actual expansion budget')
          }
          zip.readEntry()
        })().catch(reject)
      })
      zip.readEntry()
    })
  } finally {
    zip.close()
  }
}
