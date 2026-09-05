// 文件夹上传的伴随义务：官方附件管线不滤系统/隐藏文件（2026-09-05 实测
// 附件库混入 Office 临时锁文件），过滤是本插件独有入口的责任。隐藏文件
// 一律跳过同时是隐私边界——.env 等含密钥文件不应进附件库。

const JUNK_BASENAMES = new Set(['thumbs.db', 'desktop.ini'])

/**
 * 判定一个上传候选是否为系统/隐藏垃圾。`path` 取 webkitRelativePath
 * （含目录前缀）或裸文件名，只看最后一段 basename。
 */
export function isJunkPath(path: string): boolean {
  const base = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  if (base === '') return true
  const lower = base.toLowerCase()
  if (JUNK_BASENAMES.has(lower)) return true
  // Office 锁文件（~$x.docx）、WPS 锁变体（.~xxx）、AppleDouble（._x）
  // 及一切点开头的隐藏文件（.DS_Store、.env）。
  if (base.startsWith('~$') || base.startsWith('.~') || base.startsWith('.')) return true
  // Word 另存崩溃残留（~WRLxxxx.tmp）与 macOS 自定义图标文件（Icon\r）。
  if (base.startsWith('~WRL')) return true
  if (/^icon[\r\n]?$/i.test(base)) return true
  return false
}

export interface JunkCandidate {
  name: string
  webkitRelativePath?: string
}

/** 把上传候选分成可上传与垃圾两部分，junkCount 供 UI 明示跳过数量。 */
export function splitJunk<T extends JunkCandidate>(files: readonly T[]): { keep: T[]; junkCount: number } {
  const keep: T[] = []
  let junkCount = 0
  for (const file of files) {
    const path = file.webkitRelativePath !== '' && file.webkitRelativePath !== undefined ? file.webkitRelativePath : file.name
    if (isJunkPath(path)) junkCount++
    else keep.push(file)
  }
  return { keep, junkCount }
}
