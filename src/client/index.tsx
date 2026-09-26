// dsh-files 0.5.3 client face — folder upload (toolbar button + "+" menu
// command), attachment dock, @ source.
//
// Folder upload (0.5.3): two entries into one shared flow. The toolbar
// button sits in `conversation.input.left` next to the native paperclip
// (one click, always visible); the "+" popup menu carries the same action
// as an official ActionSpec contribution (the /feedback shape). Real-use
// feedback 2026-09-12: a menu-only entry buried the action at rank ~32/35
// (CJK sorts last) — undiscoverable, so the button came back. Files enter
// the host's native attachment pipeline (createDrafts + addAttachments):
// progress, cancellation and the model handle line stay owned by the host.
//
// Attachment dock (0.5.3): one official Pill in `conversation.composer.dock`
// (collapsed) expanding into the library card — see dock.tsx.
//
// @ source (0.6.1): an additional attachment source alongside the host's
// workspace source. Picking one inserts the official model-faceable file
// handle text (the host computes it via the LLM seam), so the agent sees the
// same line it saw at upload time.

import {
  ensureStyles,
  AttachmentDock,
  FolderButton,
  fetchAttachments,
  pickFolder,
  runFolderUpload,
  setFolderUploader
} from './dock.tsx'
import type { FolderUploader } from './dock.tsx'
import { formatBytes } from '../format.ts'

interface DraftDescriptor {
  id: string
}

/** Duck-typed slice of the host conversation client service (0.1.3+). */
interface ConversationService {
  createDrafts(sessionId: string, files: readonly File[]): readonly DraftDescriptor[]
}

interface SessionRef {
  sessionId: string
}

function conversationOf(ctx: any, sessionId: string): ConversationService | undefined {
  const conversation = ctx.sessions?.scope?.(sessionId)?.get?.('conversation')
  return conversation !== undefined && typeof conversation.createDrafts === 'function' ? conversation : undefined
}

/** Draft creation through the official pipeline — shared by every entry. */
function makeFolderUploader(ctx: any): FolderUploader {
  return (sessionId, files) => {
    const conversation = conversationOf(ctx, sessionId)
    if (conversation === undefined) {
      return { error: 'native attachment pipeline unavailable (harness >= 0.1.3 required)' }
    }
    try {
      const drafts = conversation.createDrafts(sessionId, files)
      return { ids: drafts.map((draft) => draft.id) }
    } catch (error: unknown) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
}

// ===================== + menu folder command (0.5.3) =====================

interface CommandUiLike {
  register(contribution: unknown): () => void
}

/**
 * Register the folder-upload action in the official "+" command menu
 * (ctx.commandUi contribution, ActionSpec). The service may initialize after
 * this plugin's apply, so registration rides ctx.inject; on hosts without
 * the command surface at all, a timed warn keeps the absence diagnosable.
 */
function registerFolderCommand(ctx: any): void {
  const uploader = makeFolderUploader(ctx)
  const contribution = {
    name: '上传文件夹',
    description: () => '选择文件夹，展开其中全部文件加入输入区（自动跳过系统/隐藏文件）',
    available: (session: SessionRef) => conversationOf(ctx, session.sessionId) !== undefined,
    ui: {
      kind: 'action',
      run: (session: SessionRef) => {
        void pickFolder().then(async (files) => {
          if (files.length > 0) await runFolderUpload(files, session.sessionId)
        })
      }
    }
  }
  let registered = false
  const register = (commandUi: CommandUiLike) => {
    if (registered) return
    registered = true
    commandUi.register(contribution)
  }
  if (ctx.commandUi !== undefined) {
    register(ctx.commandUi)
  } else if (typeof ctx.inject === 'function') {
    ctx.inject(['commandUi'], (scope: { commandUi?: CommandUiLike }) => {
      if (scope.commandUi !== undefined) register(scope.commandUi)
    })
  }
  setTimeout(() => {
    if (!registered) {
      console.warn('[dsh-files] commandUi 服务未就绪——+ 菜单里的「上传文件夹」入口未注册（harness 过旧或命令服务缺失）')
    }
  }, 5000)
}

// ===================== @ attachment source (0.6.1) =====================

const SOURCE_NAME = 'dsh-files-attachments'

/** Register the attachment @ source next to the host's workspace source. */
function registerAttachmentSource(ctx: {
  inputTriggers: { registerSource(source: Record<string, unknown>): void }
  effect(fn: () => unknown): void
}): void {
  if (typeof ctx.inputTriggers?.registerSource !== 'function') return
  ctx.effect(() =>
    ctx.inputTriggers.registerSource({
      trigger: '@',
      name: SOURCE_NAME,
      order: 20,
      showGroupTitle: true,
      // 5a: 候选 = 附件库条目；只有 host 给出官方 handle 文本的行才提供引用
      // (模型能看到与上传时一致的文件行)。插入文本即 handle 本身——与官方
      // @ 引用只插路径的契约不同，附件不在工作区，模型识别的就是 handle 行。
      candidates: async () => {
        const result = await fetchAttachments()
        if (result === undefined) return []
        // 库内有附件却全部缺 handle = llm 服务缺席，@ 组会静默消失——
        // 留一条可诊断日志，区分「没附件」和「服务没接上」。
        if (result.rows.length > 0 && result.rows.every((row) => row.handle === undefined || row.handle === '')) {
          console.warn('[dsh-files] @ 附件源：库内有附件但 host 未提供 handle（llm 服务缺席），候选不可用')
        }
        return result.rows
          .filter((row) => row.handle !== undefined && row.handle !== '')
          .slice(0, 50)
          .map((row) => ({
            name: row.name,
            description: `附件 · ${formatBytes(row.bytes)}`,
            icon: 'file',
            value: row.handle ?? row.ref
          }))
      },
      onPick: (pick: { candidate?: { value?: string } }) => {
        const handle = pick.candidate?.value
        if (handle === undefined || handle === '') return undefined
        return {
          insert: {
            source: SOURCE_NAME,
            ref: handle,
            label: handle.split(/[\\/]/).filter(Boolean).pop() ?? '附件',
            appearance: 'file',
            clipboardText: handle
          }
        }
      },
      codec: {
        clipboardText: (text: string) => text,
        serialize: async (text: string) => text
      }
    })
  )
}

export function apply(ctx: any): void {
  ensureStyles()

  // ---- Folder upload, entry 1: the toolbar button (always visible) ----
  // Same compact-control slot as the host's paperclip; the shared flow owns
  // everything after the pick.
  setFolderUploader(makeFolderUploader(ctx))
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.left',
        id: 'dsh-files-folder',
        order: 0,
        inject: () => ({})
      },
      FolderButton
    )
  )

  // ---- Folder upload, entry 2: the official "+" menu command ----
  registerFolderCommand(ctx)

  // ---- Attachment library: a composer-dock pill + card ----
  // conversation.composer.dock is the host's slot for "ambient entries below
  // the composer card" (its own occupant is StatsPills). The dock bridges the
  // session identity and input actions to the shared upload flow.
  ctx.slots.inject('conversation.composer.dock', () =>
    ctx.slots.register(
      {
        name: 'conversation.composer.dock',
        id: 'dsh-files-attachments',
        order: 0,
        inject: (sessionId: string | undefined) => ({ sessionId })
      },
      AttachmentDock
    )
  )

  // ---- @ 附件源（0.6.1，5a handle 插入） ----
  registerAttachmentSource(ctx)
}

// Client bundles load through the ModuleLoader factory; esbuild's iife format
// does not write entry exports into module.exports, so assign explicitly.
// commandUi 必须显式声明——cordis 对未注入服务的属性访问直接抛错（0.5.3
// 真机实测：声明缺失时整个客户端插件树加载失败并白屏报错）。
declare const module: { exports: unknown } | undefined
if (typeof module !== 'undefined' && module !== null) {
  module.exports = {
    apply,
    inject: ['slots', 'sessions', 'inputTriggers', 'commandUi']
  }
}
