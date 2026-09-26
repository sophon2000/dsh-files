// dsh-files 0.5.3 client face — attachment dock (pill + card), folder
// drag-and-drop, and the feedback toast bridge.
//
// Attachment dock (composer.dock): the collapsed state is one official
// `Pill` — the same primitive and visual language as the host's own
// StatsPills occupant of this slot — showing the library summary; expanding
// reveals the card below it. Client-side filtering (the full list is already
// in memory), a staleness window on re-expand, and a display cap keep the
// panel off the request path and the DOM small.
//
// Folder drag-and-drop lives here too: the dock is session-scoped and always
// mounted while a session is active, exactly the lifetime the window-level
// drop interception needs. Only drags that actually contain a directory are
// intercepted; plain file drags stay entirely with the host's pipeline.
//
// Toast bridge: the official Toast primitive is owner-mounted, so the dock
// (the one always-present session UI this plugin has) hosts it and exposes a
// module-level `notify` for feedback from places without UI of their own —
// the + menu command action and drag-drop outcomes.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconChevronDownOutlineMedium,
  IconChevronUpOutlineMedium,
  IconDownloadOutlineMedium,
  IconFolderCloseMedium,
  IconFolderOpenOutlineMedium,
  IconLoadingOutlineMedium,
  IconPaperclipOutlineMedium,
  IconRefreshOutlineMedium,
  IconRightUpOutlineMedium,
  Pill,
  Toast,
  Tooltip
} from '@deepseek-ai/dsh-client-ui-primitives'
import { splitJunk } from './junk.ts'
import { displayRows } from './rows.ts'
import { formatBytes, formatTimeShort } from '../format.ts'

const STYLE_TAG = 'dsh-files/style.css'

export function ensureStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-files'
  tag.dataset.pluginCss = STYLE_TAG
  tag.textContent = `
/* 文件夹按钮：与官方回形针（InputBar .add）同款 28px 圆形 + 官方设计变量，
   深浅色模式自动跟随。 */
.dsh-files-btn{width:28px;height:28px;padding:0;border:none;border-radius:999px;background:var(--dsw-specific-selector);display:grid;place-items:center;color:var(--dsw-alias-label-primary);cursor:pointer;line-height:0;corner-shape:round}
.dsh-files-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}
.dsh-files-btn:disabled{opacity:.5;cursor:default}
/* 紧贴回形针：官方工具行的槽位固定渲染在权限/plan 控件之后，这里用 flex
   order 把按钮提到回形针右侧、权限控件押后。选择器按结构特征识别工具行
   （直接拥有 file input 且包含本按钮的容器），不绑定宿主 css-modules 哈希
   ——宿主改版导致选择器失配时规则自动失效，按钮退回默认槽位，功能无损。 */
.dsh-files-btn{order:2}
div:has(> input[type="file"]):has(.dsh-files-btn) > div:not(:has(.dsh-files-btn)){order:3}
/* 附件库入口：官方 Pill 收起态 + 展开卡片，跟随 composer.dock 槽位列宽。 */
.dsh-files-entry{width:100%;display:flex;flex-direction:column;align-items:center;gap:6px}
.dsh-files-dock{box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:8px;padding:8px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip,var(--dsw-alias-fill-l1,#fff));overflow:hidden}
.dsh-files-dock-tools{display:flex;gap:6px}
.dsh-files-dock-search{flex:1;min-width:0;height:28px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;outline:none}
.dsh-files-dock-search:focus{border-color:var(--dsw-alias-state-business-primary)}
.dsh-files-dock-refresh{flex:none;display:grid;place-items:center;width:28px;height:28px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsh-files-dock-refresh:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover-solid)}
.dsh-files-dock-note{font-size:12px;line-height:18px;color:var(--dsw-alias-state-info-primary,#4d6bfe)}
.dsh-files-dock-list{display:flex;flex-direction:column;max-height:220px;margin:0;padding:0;list-style:none;overflow-y:auto}
.dsh-files-dock-row{display:flex;align-items:center;gap:10px;min-width:0;padding:4px 0;font-size:13px;line-height:20px}
.dsh-files-dock-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:var(--dsw-alias-label-primary)}
.dsh-files-dock-meta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dsh-files-dock-action{flex:none;display:grid;place-items:center;width:24px;height:24px;padding:0;border:none;border-radius:6px;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;text-decoration:none}
.dsh-files-dock-action:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover-solid)}
.dsh-files-dock-empty{padding:16px 0;text-align:center;font-size:13px;color:var(--dsw-alias-label-tertiary)}
.dsh-files-dock-more{padding-top:2px;text-align:center;font-size:11px;color:var(--dsw-alias-label-tertiary)}
/* 文件夹拖拽遮罩：只有拖入目录时才亮，普通文件拖拽完全交给官方管线。 */
.dsh-files-dragging:after{content:'松开以上传文件夹';position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:#fff;background:rgba(0,0,0,.45);z-index:9999;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.5)}`
  document.head.appendChild(tag)
}

// ===================== module bridges =====================

/**
 * The webkitdirectory folder picker shared by the toolbar button and the
 * + menu command. Cancel → [] (change never fires on cancel; a leftover
 * hidden input would accumulate across cancellations).
 */
export function pickFolder(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    ;(input as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true
    input.style.display = 'none'
    let settled = false
    const finish = (files: File[]) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(files)
    }
    input.addEventListener('cancel', () => finish([]))
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])))
    document.body.appendChild(input)
    input.click()
  })
}

/** Draft creation through the host conversation service (wired in apply). */
export type FolderUploader = (sessionId: string, files: readonly File[]) => FolderUploadResult
export type FolderUploadResult = { ids: readonly string[] } | { error: string }

interface InputActionsLike {
  addAttachments(ids: readonly string[]): boolean
}

let folderUploader: FolderUploader | undefined
let currentSessionId: string | undefined
let currentInputActions: InputActionsLike | undefined
let toastBridge: ((text: string) => void) | undefined
let uploadBusy = false

export function setFolderUploader(uploader: FolderUploader): void {
  folderUploader = uploader
}

/** Owner-mounted Toast needs a host; the dock is that host. */
export function notify(text: string): void {
  if (toastBridge !== undefined) toastBridge(text)
  else console.info('[dsh-files]', text)
}

/**
 * Shared folder-upload flow for every entry point (+ menu command and
 * directory drop): junk filter, draft creation through the official
 * pipeline, draft attach, and one toast for the outcome.
 */
export async function runFolderUpload(files: readonly File[], explicitSessionId?: string): Promise<void> {
  if (uploadBusy) {
    notify('上一个文件夹仍在处理中，请稍候')
    return
  }
  const sessionId = explicitSessionId ?? currentSessionId
  if (sessionId === undefined) {
    notify('无当前会话，无法上传')
    return
  }
  if (currentInputActions === undefined) {
    notify('输入区不可用')
    return
  }
  uploadBusy = true
  try {
    const { keep, junkCount } = splitJunk(files)
    if (keep.length === 0) {
      if (junkCount > 0) notify(`未添加：${junkCount} 个均为系统/隐藏文件`)
      return
    }
    const result = folderUploader?.(sessionId, keep)
    if (result === undefined || 'error' in result) {
      console.warn('dsh-files: folder drafts rejected:', result?.error)
      notify('添加失败')
      return
    }
    const added = currentInputActions.addAttachments([...result.ids])
    if (!added) notify('输入区忙，稍后重试')
    else if (junkCount > 0) notify(`已添加 ${keep.length} 个文件，跳过 ${junkCount} 个系统/隐藏文件`)
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error))
  } finally {
    uploadBusy = false
  }
}

// ===================== directory drag-and-drop =====================

/**
 * The host's drop pipeline has no webkitGetAsEntry anywhere: a dragged
 * directory reaches it as one unreadable File and fails. These helpers keep
 * directory drag-and-drop working. They only engage when the drag actually
 * contains a directory — plain file drags are left entirely to the host.
 */
function dragContainsDirectory(dt: DataTransfer | null): boolean {
  if (dt === null) return false
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry?.()
    if (entry !== null && entry !== undefined && entry.isDirectory) return true
  }
  return false
}

/**
 * Flatten a DataTransfer into concrete files; directories recurse.
 *
 * Chrome 的 drop 保护模式：事件处理同步栈结束后，DataTransferItem 的
 * webkitGetAsEntry()/getAsFile() 一律返回 null。因此必须在 drop 事件栈内
 * 一次性把所有 item 快照成 FileSystemEntry/File 引用，之后再异步展开——
 * 否则第二个起的文件/目录会被静默丢弃。
 */
async function collectFiles(dt: DataTransfer | null): Promise<File[]> {
  const files: File[] = []
  if (dt === null) return files
  const roots: Array<FileSystemEntry | File | null> = Array.from(dt.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => {
      const entry = item.webkitGetAsEntry?.()
      return entry !== undefined && entry !== null ? entry : item.getAsFile()
    })
  const got = new Set<string>()
  const addFile = (file: File): void => {
    // Dedup key prefers webkitRelativePath (directory prefix included):
    // same-named files in different directories must all survive.
    const key = file.webkitRelativePath !== '' ? file.webkitRelativePath : file.name
    if (!got.has(key)) {
      got.add(key)
      files.push(file)
    }
  }
  const visit = async (node: FileSystemEntry | File): Promise<void> => {
    if (node instanceof File) {
      addFile(node)
      return
    }
    if (node.isFile) {
      const file = await new Promise<File | null>((resolve) => (node as FileSystemFileEntry).file(resolve))
      if (file !== null) addFile(file)
    } else if (node.isDirectory) {
      const reader = (node as FileSystemDirectoryEntry).createReader()
      // readEntries caps at ~100 entries per call; loop until empty.
      while (true) {
        const batch = await new Promise<FileSystemEntry[] | null>((resolve) => reader.readEntries(resolve))
        if (batch === null || batch.length === 0) break
        for (const child of batch) await visit(child)
      }
    }
  }
  for (const root of roots) {
    if (root !== null) await visit(root)
  }
  return files
}

/** Window-capture directory drop interception; plain file drags untouched. */
function useDirectoryDrop(): void {
  useEffect(() => {
    let dragDepth = 0
    const settle = () => {
      dragDepth = 0
      document.body.classList.remove('dsh-files-dragging')
    }
    const onDragOver = (e: DragEvent) => {
      if (!dragContainsDirectory(e.dataTransfer ?? null)) return
      e.preventDefault()
      e.stopPropagation()
      // dragover 在悬停期间高频重复触发，不能每次都计数——只在首次进入
      // （遮罩未亮）时 +1，与 dragleave 的 -1 对称；否则悬停片刻后 depth
      // 虚高，拖出窗口时一次 -1 归不了零，遮罩永久残留。
      if (document.body.classList.contains('dsh-files-dragging')) return
      dragDepth += 1
      document.body.classList.add('dsh-files-dragging')
    }
    const onDragLeave = (e: DragEvent) => {
      if (!document.body.classList.contains('dsh-files-dragging')) return
      // Only a leave that truly exits the document may clear the overlay;
      // element-internal leaves (relatedTarget still on page) must not.
      if (e.relatedTarget !== null) return
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) settle()
    }
    const onDrop = (e: DragEvent) => {
      if (!dragContainsDirectory(e.dataTransfer ?? null)) return
      e.preventDefault()
      e.stopPropagation()
      settle()
      const dt = e.dataTransfer
      void (async () => {
        try {
          await runFolderUpload(await collectFiles(dt ?? null))
        } catch (error) {
          notify(error instanceof Error ? error.message : String(error))
        }
      })()
    }
    const onDragEnd = () => settle()
    window.addEventListener('dragover', onDragOver, true)
    window.addEventListener('dragleave', onDragLeave, true)
    window.addEventListener('drop', onDrop, true)
    window.addEventListener('dragend', onDragEnd, true)
    return () => {
      settle()
      window.removeEventListener('dragover', onDragOver, true)
      window.removeEventListener('dragleave', onDragLeave, true)
      window.removeEventListener('drop', onDrop, true)
      window.removeEventListener('dragend', onDragEnd, true)
    }
  }, [])
}

// ===================== toolbar folder button =====================

/**
 * Compact composer control at `conversation.input.left` — same slot family
 * as the host's native paperclip. One click opens the folder picker and the
 * shared upload flow takes over (junk filter → official drafts → attach →
 * toast). The + menu contribution is the second entry to the same flow.
 */
export function FolderButton() {
  const [busy, setBusy] = useState(false)
  return (
    <Tooltip label={busy ? '添加中…' : '上传文件夹'} side="top" delayMs={500}>
      <button
        type="button"
        className="dsh-files-btn"
        aria-label="上传文件夹"
        disabled={busy}
        onClick={() => {
          if (busy) return
          setBusy(true)
          void pickFolder().then(async (files) => {
            try {
              if (files.length > 0) await runFolderUpload(files)
            } finally {
              setBusy(false)
            }
          })
        }}
      >
        <IconFolderOpenOutlineMedium size={14} />
      </button>
    </Tooltip>
  )
}

// ===================== attachment dock =====================

export interface AttachmentItem {
  name: string
  sha: string
  bytes: number
  modifiedMs: number
  ref: string
  handle?: string
}

interface AttachmentListResponse {
  rows: AttachmentItem[]
  total: number
  totalBytes: number
}

/** Fetch the library list (unfiltered; the panel filters client-side). */
export async function fetchAttachments(): Promise<AttachmentListResponse | undefined> {
  try {
    const response = await fetch('/plugins/dsh-files/attachments?limit=300', {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) return undefined
    return (await response.json()) as AttachmentListResponse
  } catch {
    return undefined
  }
}

/** Re-expand within this window reuses the in-memory list instead of refetching. */
const STALE_MS = 30_000

interface DockProps {
  sessionId: string | undefined
  inputActions: InputActionsLike | undefined
}

export function AttachmentDock({ sessionId, inputActions }: DockProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AttachmentItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalBytes, setTotalBytes] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)
  const seq = useRef(0)
  const toastSeq = useRef(0)
  const lastLoadedRef = useRef(0)

  // Bridge the session identity and input actions for the shared upload flow
  // (+ menu command runs outside any slot component and needs both).
  useEffect(() => {
    currentSessionId = sessionId
    currentInputActions = inputActions
    return () => {
      currentSessionId = undefined
      currentInputActions = undefined
    }
  }, [sessionId, inputActions])

  useEffect(() => {
    toastBridge = (text: string) => setToast({ seq: ++toastSeq.current, text })
    return () => {
      toastBridge = undefined
    }
  }, [])

  useDirectoryDrop()

  const load = () => {
    const mySeq = ++seq.current
    setLoading(true)
    void fetchAttachments().then((result) => {
      if (mySeq !== seq.current) return // superseded
      setLoading(false)
      lastLoadedRef.current = Date.now()
      if (result === undefined) {
        setItems([])
        setTotal(0)
        setTotalBytes(0)
        setNote('清单不可用（检查 host 或 attachments 服务）')
        return
      }
      setItems(result.rows)
      setTotal(result.total)
      setTotalBytes(result.totalBytes)
    })
  }

  // The collapsed pill carries the summary, so load on mount and on every
  // session switch; re-expanding refetches only after the staleness window.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && Date.now() - lastLoadedRef.current > STALE_MS) load()
  }

  // Search never leaves the page: the full list is already in memory.
  const { rows: visible, hidden } = useMemo(() => displayRows(items, q), [items, q])

  // Re-insert: pull the stored bytes back into the browser and register them
  // as a fresh draft through the official pipeline — the composer rail shows
  // the native attachment card and the model receives a new handle line, so
  // an old upload rides any (new) session without re-picking from disk.
  const [insertingRef, setInsertingRef] = useState<string | null>(null)
  const insertOne = async (item: AttachmentItem) => {
    if (sessionId === undefined) {
      notify('无当前会话，无法插入')
      return
    }
    if (currentInputActions === undefined || folderUploader === undefined) {
      notify('输入区不可用')
      return
    }
    setInsertingRef(item.ref)
    try {
      const response = await fetch(`/plugins/dsh-files/attachments/download?ref=${encodeURIComponent(item.ref)}`)
      if (!response.ok) {
        const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined
        notify(body?.error ?? (response.status === 413 ? '文件超过下载上限，请改用「导出」' : '读取附件失败'))
        return
      }
      const blob = await response.blob()
      const result = folderUploader(sessionId, [new File([blob], item.name)])
      if ('error' in result) {
        notify('插入失败')
        return
      }
      const added = currentInputActions.addAttachments([...result.ids])
      notify(added ? `已插入 ${item.name} 到输入区` : '输入区忙，稍后重试')
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setInsertingRef(null)
    }
  }

  const exportOne = async (item: AttachmentItem) => {
    if (sessionId === undefined) {
      setNote('无当前会话')
      return
    }
    setNote('')
    try {
      const response = await fetch(
        `/plugins/dsh-files/attachments/export?session=${encodeURIComponent(sessionId)}&ref=${encodeURIComponent(item.ref)}`,
        { method: 'POST' }
      )
      const body = (await response.json()) as { relativePath?: string; error?: string }
      if (response.ok && body.relativePath !== undefined) {
        setNote(`已导出到工作区 ${body.relativePath}`)
      } else {
        setNote(body.error ?? '导出失败')
      }
    } catch {
      setNote('导出失败')
    }
  }

  return (
    <div className="dsh-files-entry">
      <Pill onClick={toggle} aria-expanded={open} aria-label="附件库">
        <IconFolderCloseMedium size={12} />
        附件库 {total} 个 · {formatBytes(totalBytes)}
        {open ? <IconChevronUpOutlineMedium size={12} /> : <IconChevronDownOutlineMedium size={12} />}
      </Pill>
      {open ? (
        <div className="dsh-files-dock">
          <div className="dsh-files-dock-tools">
            <input
              className="dsh-files-dock-search"
              type="search"
              placeholder="按文件名搜索…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
            <button type="button" className="dsh-files-dock-refresh" aria-label="刷新" onClick={load}>
              <IconRefreshOutlineMedium size={13} />
            </button>
          </div>
          {note !== '' ? <div className="dsh-files-dock-note">{note}</div> : null}
          <div className="dsh-files-dock-list">
            {loading ? <div className="dsh-files-dock-empty">加载中…</div> : null}
            {!loading && visible.length === 0 ? <div className="dsh-files-dock-empty">暂无附件</div> : null}
            {visible.map((item) => (
              <div className="dsh-files-dock-row" key={item.ref} title={`${item.name} · ${formatTimeShort(item.modifiedMs)}`}>
                <span className="dsh-files-dock-name">{item.name}</span>
                <span className="dsh-files-dock-meta">
                  {formatBytes(item.bytes)} · {formatTimeShort(item.modifiedMs)}
                </span>
                <button
                  type="button"
                  className="dsh-files-dock-action"
                  aria-label={`重新插入 ${item.name} 到输入区`}
                  title="重新插入到输入区（作为本条消息的附件）"
                  disabled={insertingRef === item.ref}
                  onClick={() => void insertOne(item)}
                >
                  {insertingRef === item.ref ? <IconLoadingOutlineMedium size={14} /> : <IconPaperclipOutlineMedium size={14} />}
                </button>
                <a
                  className="dsh-files-dock-action"
                  href={`/plugins/dsh-files/attachments/download?ref=${encodeURIComponent(item.ref)}`}
                  download={item.name}
                  aria-label={`下载 ${item.name}`}
                  title="下载"
                >
                  <IconDownloadOutlineMedium size={14} />
                </a>
                <button
                  type="button"
                  className="dsh-files-dock-action"
                  aria-label={`导出 ${item.name} 到工作区`}
                  title="导出到工作区"
                  onClick={() => void exportOne(item)}
                >
                  <IconRightUpOutlineMedium size={14} />
                </button>
              </div>
            ))}
          </div>
          {hidden > 0 ? <div className="dsh-files-dock-more">已显示最近 {visible.length} 条，共 {total} 条</div> : null}
        </div>
      ) : null}
      {toast !== null ? <Toast key={toast.seq} text={toast.text} onDone={() => setToast(null)} /> : null}
    </div>
  )
}
