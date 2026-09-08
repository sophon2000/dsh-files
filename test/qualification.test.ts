import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { runParser } from '../src/parse/runner.ts'
import { parseLimits } from '../src/parse/limits.ts'
import { checkArchive } from '../src/parse/archive.ts'
import { defineReadDocumentTool } from '../src/tool.ts'
import { FsTargetKey, FsVersion } from '@deepseek-ai/dsh-fs'
import type { ParseRequest } from '../src/parse/worker.ts'

function request(overrides: Partial<ParseRequest> = {}): ParseRequest {
  return { bytes: new TextEncoder().encode('alpha\nbeta'), format: 'text', options: { sheetRowLimit: 200 },
    limits: parseLimits(), offset: 2, limit: 1, maxOutputChars: 2000, ...overrides }
}

test('worker parses and windows real text without mutating input', async () => {
  const input = request()
  const before = input.bytes.slice()
  const result = await runParser(input, new AbortController().signal)
  assert.equal(result.lines[0]?.text, 'beta')
  assert.deepEqual(input.bytes, before)
})

test('parsed text budget rejects instead of returning an unmarked partial document', async () => {
  await assert.rejects(runParser(request({ limits: parseLimits({ maxParsedChars: 3 }) }), new AbortController().signal), /parsed text budget/)
})

test('invalid PDF is a settled parser error', async () => {
  await assert.rejects(runParser(request({ format: 'pdf' }), new AbortController().signal))
})

test('PDF page budget is enforced by real parser', async () => {
  const pdf = await PDFDocument.create()
  pdf.addPage(); pdf.addPage()
  await assert.rejects(runParser(request({ bytes: await pdf.save(), format: 'pdf', limits: parseLimits({ maxPdfPages: 1 }) }), new AbortController().signal), /page budget/)
})

test('ZIP budgets: actual inflated content, member count and ratio', async () => {
  const zip = new JSZip()
  zip.file('one.xml', 'A'.repeat(10000))
  zip.file('two.xml', 'B')
  const compressed = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  await assert.rejects(checkArchive(compressed, parseLimits({ maxExpandedBytes: 5000 })), /expansion budget/)
  await assert.rejects(checkArchive(compressed, parseLimits({ maxCompressionRatio: 10 })), /expansion budget/)
  const stored = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
  await assert.rejects(checkArchive(stored, parseLimits({ maxArchiveEntries: 1 })), /expansion budget/)
  await checkArchive(stored, parseLimits())
})

test('ZIP false uncompressed-size metadata is rejected', async () => {
  const zip = new JSZip().file('entry.xml', 'X'.repeat(10000))
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  assert.ok(central >= 0)
  bytes.writeUInt32LE(1, central + 24)
  await assert.rejects(checkArchive(bytes, parseLimits()), /size|bytes/i)
})

test('Office archive validation happens before parser dispatch', async () => {
  const bytes = await new JSZip().file('bomb.xml', 'A'.repeat(50000)).generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  await assert.rejects(runParser(request({ bytes, format: 'xlsx' }), new AbortController().signal), /expansion budget/)
})

test('invalid or extreme deployment budgets fail closed', () => {
  for (const value of [0, -1, NaN, Infinity, 1.5]) assert.throws(() => parseLimits({ maxParseMs: value }))
  assert.throws(() => parseLimits({ workerHeapMb: 1024 }), /ceiling/)
  assert.throws(() => parseLimits({ maxConcurrentReads: 100 }), /ceiling/)
})

test('already aborted call never starts a worker', async () => {
  const controller = new AbortController(); controller.abort()
  await assert.rejects(runParser(request(), controller.signal, new URL('file:///nonexistent-worker.mjs')), /aborted/)
})

test('cancel and timeout terminate CPU-bound worker before settling; no post-return work', async () => {
  const dir = await mkdtemp(`${tmpdir()}/dsh-files-worker-test-`)
  try {
    const file = `${dir}/busy.mjs`
    await writeFile(file, "import {workerData} from 'node:worker_threads';const a=new Int32Array(workerData.bytes.buffer);while(true){Atomics.add(a,0,1)}")
    for (const mode of ['abort', 'timeout']) {
      const counters = new Int32Array(new SharedArrayBuffer(4))
      const controller = new AbortController()
      const pending = assert.rejects(runParser(request({ bytes: new Uint8Array(counters.buffer), limits: parseLimits({ maxParseMs: 1000 }) }), controller.signal, pathToFileURL(file)), mode === 'abort' ? /aborted/ : /time budget/)
      const deadline = Date.now() + 900
      while (Atomics.load(counters, 0) === 0 && Date.now() < deadline) await new Promise(r => setTimeout(r, 10))
      assert.notEqual(Atomics.load(counters, 0), 0, 'worker must actually enter CPU loop')
      if (mode === 'abort') controller.abort()
      await pending
      const stopped = Atomics.load(counters, 0)
      await new Promise(r => setTimeout(r, 50))
      assert.equal(Atomics.load(counters, 0), stopped, 'worker is not left running')
    }
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('worker exit and malformed reply are rejected', async () => {
  const dir = await mkdtemp(`${tmpdir()}/dsh-files-protocol-test-`)
  try {
    for (const body of ['process.exit(0)', "import {parentPort} from 'node:worker_threads';parentPort.postMessage({ok:true,value:{lines:'bad'}})", "import {parentPort} from 'node:worker_threads';parentPort.postMessage({ok:true,value:{totalLines:1,lines:[null]}})"]) {
      const file = `${dir}/test.mjs`; await writeFile(file, body)
      await assert.rejects(runParser(request(), new AbortController().signal, pathToFileURL(file)), /without result|invalid parser/)
    }
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('worker heap exhaustion is contained as a rejected call', async () => {
  const dir = await mkdtemp(`${tmpdir()}/dsh-files-heap-test-`)
  try {
    const file = `${dir}/heap.mjs`
    await writeFile(file, 'const arrays=[];while(true)arrays.push(new Array(65536).fill(0))')
    await assert.rejects(runParser(request({ limits: parseLimits({ workerHeapMb: 16, maxParseMs: 3000 }) }), new AbortController().signal, pathToFileURL(file)), /memory|heap/i)
    assert.equal((await runParser(request(), new AbortController().signal)).lines[0]?.text, 'beta')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('concurrency gate is before filesystem I/O and releases after completion', async () => {
  let release!: () => void
  const gate = new Promise<void>(r => { release = r })
  let reads = 0
  const tool = defineReadDocumentTool({ emit() {}, fs: {
    resolve: async () => { reads++; await gate; return { targetKey: FsTargetKey('test'), displayPath: '/test' } },
    stat: async () => ({ version: FsVersion('v1'), type: 'file', size: 1 }),
    readBytes: async () => new Uint8Array([65])
  } }, { readLimit: 100, maxFileBytes: 100, sheetRowLimit: 100, maxSheets: 1, maxOutputChars: 2000, parser: { maxConcurrentReads: 1 } })
  const exec = { signal: new AbortController().signal } as Parameters<typeof tool.execute>[1]
  const first = tool.execute({ file_path: 'test' }, exec)
  await assert.rejects(tool.execute({ file_path: 'test' }, exec), /busy/)
  assert.equal(reads, 1)
  release(); await first
  await tool.execute({ file_path: 'test' }, exec)
  assert.equal(reads, 2)
})

test('default built client is a no-op and never requires document/slots', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let plugin: { apply(ctx: unknown): void } | undefined
  runInNewContext(source, { window: { __ModuleLoader__: { load: ({ factory }: { factory(require: unknown): typeof plugin }) => { plugin = factory(() => ({})) } } } })
  assert.ok(plugin)
  plugin.apply({})
  assert.doesNotMatch(source, /JNhZqW/)
})
