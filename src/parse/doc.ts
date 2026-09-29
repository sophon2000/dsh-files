// Legacy Word 97-2003 (.doc) text extraction. 金标对照（2026-09-05，附件库
// 4 个真实法规 .doc）：两者正文量级相当（注意口径——textutil 用 wc -c 数
// UTF-8 字节、word-extractor 用 JS length 数 UTF-16 码元，中文差 3 倍是口
// 径假象）；实质差异在 word-extractor 会漏文本框内容（如园林绿化条例的
// 「（2019 年 4 月 25 日通过）」日期段），故 macOS 上 textutil 是主路线；
// word-extractor（纯 JS，saxes+yauzl 两个小依赖）只做非 macOS 平台与
// textutil 失败时的兜底，质量以正文条款为限。
//
// textutil 只接受文件路径，因此 bytes 先落临时目录、用后即删——FsTarget
// 没有公开的宿主路径字段，不能依赖内部结构省这次写盘。

import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileP = promisify(execFile)

interface ExtractorDocument {
  getBody(): string
}
interface Extractor {
  extract(input: Buffer | string): Promise<ExtractorDocument>
}

function isUsableDocumentText(text: string): boolean {
  if (text.trim() === '') return false
  let controls = 0
  for (const char of text) {
    const code = char.charCodeAt(0)
    if ((code < 0x20 && char !== '\n' && char !== '\r' && char !== '\t') || code === 0x7f) controls++
  }
  return controls / text.length < 0.05
}

export async function parseDocViaTextutil(bytes: Uint8Array): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-files-doc-'))
  try {
    const docPath = join(dir, 'input.doc')
    await writeFile(docPath, bytes)
    const { stdout } = await execFileP('textutil', ['-convert', 'txt', '-stdout', docPath], {
      // 100KB 级 .doc 转出的纯文本远小于此；防超大输出把进程打爆。
      maxBuffer: 64 * 1024 * 1024
    })
    return stdout
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function parseDocViaWordExtractor(bytes: Uint8Array): Promise<string> {
  // 动态 import：只有真正走到 doc 兜底才加载（约 550KB 纯 JS）。
  const mod = (await import('word-extractor')) as { default: new () => Extractor }
  const extractor = new mod.default()
  const doc = await extractor.extract(Buffer.from(bytes))
  return doc.getBody()
}

export async function parseDoc(bytes: Uint8Array): Promise<string> {
  if (process.platform === 'darwin') {
    try {
      const text = await parseDocViaTextutil(bytes)
      // 损坏文件 textutil 以非零退出码失败已被 catch；空输出按失败处理走兜底。
      if (isUsableDocumentText(text)) return text
    } catch {
      // fall through to word-extractor
    }
  }
  try {
    const text = await parseDocViaWordExtractor(bytes)
    if (!isUsableDocumentText(text)) {
      throw new Error('Word document stream is empty, missing or not text')
    }
    return text
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    // OLE 容器同时覆盖老式 .xls/.ppt：头部无法区分，路由到这里后解析失败
    // 要给模型可自纠的提示，而不是裸抛内部错误。
    throw new Error(`cannot parse legacy Office document: ${reason} (OLE containers also cover old .xls/.ppt, which are not supported)`)
  }
}
