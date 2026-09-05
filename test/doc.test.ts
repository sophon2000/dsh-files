// .doc（Word 97-2003 OLE）解析：fixtures/sanming-dog-regulation.doc 是附件库
// 的真实金标（公开法规文本）。textutil 主路线在 macOS 上跑真实转换；非
// macOS（或 textutil 失败回退）走 word-extractor——两条路线的质量断言都
// 只锚定「条款正文可抽取」，不锚定字符数（textutil 比 word-extractor 多
// 约 3 倍内容，见 parse/doc.ts 头注）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { sniffHead, sniffFormat, formatFromExtension } from '../src/detect.ts'
import { parseDoc, parseDocViaWordExtractor } from '../src/parse/doc.ts'
import { formatOutputBudget } from '../src/tool.ts'

const FIXTURE = fileURLToPath(new URL('./fixtures/sanming-dog-regulation.doc', import.meta.url))

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

test('OLE compound file magic sniffs as doc', () => {
  const bytes = new Uint8Array(64)
  bytes.set(OLE_MAGIC)
  assert.equal(sniffHead(bytes), 'doc')
  assert.equal(sniffFormat(bytes), 'doc')
})

test('OLE magic is not mistaken for text or a known-rejected binary', () => {
  const bytes = new Uint8Array(64)
  bytes.set(OLE_MAGIC)
  assert.notEqual(sniffHead(bytes), 'text')
  assert.notEqual(sniffHead(bytes), null)
})

test('truncated OLE header does not sniff as doc', () => {
  const bytes = new Uint8Array(6)
  bytes.set(OLE_MAGIC.slice(0, 6))
  assert.notEqual(sniffHead(bytes), 'doc')
})

test('.doc extension maps to the doc format hint', () => {
  assert.equal(formatFromExtension('法规.doc'), 'doc')
  assert.equal(formatFromExtension('法规.DOC'), 'doc')
})

test('formatOutputBudget treats doc like docx (half)', () => {
  // doc 与 docx 同为叙述性文本。
  assert.equal(formatOutputBudget('doc', 24000), 12000)
  assert.equal(formatOutputBudget('doc', 2000), 2000)
})

test('parseDoc extracts the real regulation body', async () => {
  const bytes = await readFile(FIXTURE)
  const text = await parseDoc(bytes)
  // 金标锚点：标题、通过/批准的日期段、条款编号正文。
  assert.ok(text.includes('养犬管理条例'), 'title present')
  assert.ok(text.includes('第一条'), 'article body present')
  assert.ok(text.length > 2000, `body is substantial (got ${text.length} chars)`)
})

test('word-extractor fallback parses the fixture standalone', async () => {
  const bytes = await readFile(FIXTURE)
  const text = await parseDocViaWordExtractor(bytes)
  assert.ok(text.includes('养犬管理条例'))
  assert.ok(text.includes('第一条'))
})

test('parseDoc rejects a non-Word OLE container with a hint', async () => {
  // 伪 OLE：魔数正确但结构无效——解析器 loud fail 且提示可能是 .xls/.ppt。
  const bytes = new Uint8Array(512)
  bytes.set(OLE_MAGIC)
  await assert.rejects(() => parseDoc(bytes), /legacy Office document|\.xls/)
})
