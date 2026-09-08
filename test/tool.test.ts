// Tool-side budget tests: the per-call output character budget is split by
// format so a verbose PDF/DOCX doesn't inflate the model context to the full
// text-window allowance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatOutputBudget, defineReadDocumentTool } from '../src/tool.ts'
import { FsError, FsTargetKey, FsVersion } from '@deepseek-ai/dsh-fs'
import path from 'node:path'
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

test('text uses the full base budget', () => {
  assert.equal(formatOutputBudget('text', 24000), 24000)
})

test('xlsx gets three-quarters of the base budget', () => {
  assert.equal(formatOutputBudget('xlsx', 24000), 18000)
})

test('pdf and docx get half the base budget', () => {
  assert.equal(formatOutputBudget('pdf', 24000), 12000)
  assert.equal(formatOutputBudget('docx', 24000), 12000)
})

test('the halving never drops below the floor for a tiny base', () => {
  assert.equal(formatOutputBudget('pdf', 3000), 2000) // Math.max(2000, floor(1500))
  assert.equal(formatOutputBudget('docx', 2000), 2000)
  assert.equal(formatOutputBudget('xlsx', 2000), 2000) // floor(1500) clamped to 2000
})

test('format floor never increases the configured output budget', () => {
  for (const format of ['pdf', 'docx', 'xlsx', 'text'] as const) assert.equal(formatOutputBudget(format, 128), 128)
})

// 回归：#5 —— readBytes 的 maxBytes 是整个文件上限（stat 超限即 FS_TOO_LARGE，
// 不截断），旧实现先按 HEAD_SNIFF_BYTES(64 KiB) 嗅探头部，任何更大的文件都会
// 在嗅探阶段被拒。现在一次读满 maxFileBytes，头部从缓冲截取。
test('read_document reads files larger than 64 KiB (head sniff no longer caps the read)', async () => {
  const SIZE = 128 * 1024
  const maxFileBytes = 24 * 1024 * 1024
  const readCaps: number[] = []
  const fs = {
    resolve: async () => ({ targetKey: FsTargetKey('k-big'), displayPath: '/workspace/big.txt' }),
    stat: async () => ({ version: FsVersion('v1'), type: 'file', size: SIZE }),
    readBytes: async (_target: unknown, _signal: unknown, maxBytes: number) => {
      readCaps.push(maxBytes)
      // 复刻 @deepseek-ai/dsh-fs 契约：maxBytes 是整体上限，超限即抛错。
      if (maxBytes < SIZE) throw new FsError(`bytes exceeds the ${maxBytes}-byte limit`, 'FS_TOO_LARGE')
      return new Uint8Array(SIZE).fill(0x61) // 全 'a'，UTF-8 文本
    }
  }
  const tool = defineReadDocumentTool(
    { fs, emit: () => undefined },
    {
      readLimit: 800,
      maxFileBytes,
      sheetRowLimit: 200,
      maxSheets: 5,
      maxOutputChars: 24000
    }
  )
  const exec = { signal: new AbortController().signal, agent: undefined } as unknown as Parameters<typeof tool.execute>[1]
  const result = (await tool.execute({ file_path: 'big.txt' }, exec)) as {
    format: string
    lines: Array<{ number: number; text: string }>
    totalLines: number
  }
  assert.equal(result.format, 'text')
  assert.ok(result.lines.length > 0)
  // 只读一次，且上限是 maxFileBytes 而非 64 KiB。
  assert.deepEqual(readCaps, [maxFileBytes])
})

test('read_document still rejects files over maxFileBytes with FS_TOO_LARGE', async () => {
  const maxFileBytes = 1024
  const fs = {
    resolve: async () => ({ targetKey: FsTargetKey('k-over'), displayPath: '/workspace/over.bin' }),
    stat: async () => ({ version: FsVersion('v1'), type: 'file', size: 2048 }),
    readBytes: async () => {
      throw new Error('must not be reached')
    }
  }
  const tool = defineReadDocumentTool(
    { fs, emit: () => undefined },
    { readLimit: 800, maxFileBytes, sheetRowLimit: 200, maxSheets: 5, maxOutputChars: 24000 }
  )
  const exec = { signal: new AbortController().signal, agent: undefined } as unknown as Parameters<typeof tool.execute>[1]
  await assert.rejects(
    tool.execute({ file_path: 'over.bin' }, exec),
    (err: unknown) => err instanceof FsError && err.code === 'FS_TOO_LARGE'
  )
})

test('malformed optional arguments fail before filesystem access, never silently select defaults', async () => {
  let reads = 0
  const tool = defineReadDocumentTool({ fs: {
    resolve: async () => { reads++; throw new Error('unexpected filesystem access') },
    stat: async () => undefined,
    readBytes: async () => new Uint8Array()
  }, emit: () => undefined }, { readLimit: 800, maxFileBytes: 1024, sheetRowLimit: 200, maxSheets: 5, maxOutputChars: 24000 })
  const exec = { signal: new AbortController().signal } as Parameters<typeof tool.execute>[1]
  for (const field of ['offset', 'limit', 'sheet']) {
    for (const value of ['2', null, true, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(tool.execute({ file_path: 'book.xlsx', [field]: value }, exec), new RegExp(field))
    }
  }
  for (const value of ['true', 1, null]) await assert.rejects(tool.execute({ file_path: 'book.xlsx', list_sheets: value }, exec), /list_sheets/)
  assert.equal(reads, 0)
})

test('one tool instance resolves same-name files using each call session cwd without cross-session reuse', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-files-workspaces-'))
  try {
    for (const name of ['a', 'b']) {
      await mkdir(path.join(root, name))
      await writeFile(path.join(root, name, 'same.txt'), `ONLY_${name}`)
    }
    // This adapter verifies Tool-to-FS cwd propagation with real files/workers;
    // native DSH authorization itself is covered by the packaged Profile harness.
    const tool = defineReadDocumentTool({ fs: {
      resolve: async (file, opts) => {
        const resolved = path.resolve(opts!.cwd!, file)
        return { targetKey: FsTargetKey(resolved), displayPath: resolved }
      },
      stat: async target => ({ version: FsVersion('test'), type: 'file', size: (await stat(target.displayPath)).size }),
      readBytes: async target => readFile(target.displayPath)
    }, emit: () => undefined }, { readLimit: 800, maxFileBytes: 1024, sheetRowLimit: 200, maxSheets: 5, maxOutputChars: 24000 })
    for (let round = 0; round < 2; round++) await Promise.all(['a', 'b'].map(async name => {
      const exec = { signal: new AbortController().signal, agent: { session: { header: { cwd: path.join(root, name) } } } } as Parameters<typeof tool.execute>[1]
      const result = await tool.execute({ file_path: 'same.txt' }, exec) as { path: string; lines: Array<{ text: string }> }
      assert.equal(result.path, path.join(root, name, 'same.txt'))
      assert.equal(result.lines[0].text, `ONLY_${name}`)
    }))
  } finally { await rm(root, { recursive: true, force: true }) }
})
