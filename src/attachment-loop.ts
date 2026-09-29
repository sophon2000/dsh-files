// dsh-files 0.6.1 — attachment loop routes: list (for the panel and the @
// source), download (user pulls the file back) and export (panel button, the
// host-side counterpart of the export_attachment model tool).
//
// Data source is the same read-only library scan attachment_list uses
// (attachments.ts); byte transfer goes through the official
// AttachmentStore.readFileStream seam, never through arbitrary host paths.
//
// Two fences on every route:
//   1. browser trust — Host must be loopback or in trustedHosts (same
//      semantics as the host's --trusted-host fence and the LAN gateway).
//   2. reference shape — sha256:<64hex> normalized; capped sizes answer 413.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { createWriteStream } from 'node:fs'
import { promises as fsp } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { listAttachments } from './attachments.ts'
import { formatBytes } from './format.ts'
import { isTrustedRequest } from './attachments/fence.ts'
import { normalizeAttachmentRef, sanitizeDownloadName, sanitizeFileNameForPath, MAX_SAFE_NAME } from './attachments/ref.ts'

const BASE = '/plugins/dsh-files'

export interface AttachmentLoopConfig {
  attachmentsDir: string
  maxDownloadBytes: number
  trustedHosts: readonly string[]
}

/** Duck-typed official AttachmentStore seam (@deepseek-ai/dsh-attachment). */
interface AttachmentStoreLike {
  readFileStream(
    ref: { attachmentId: string; name: string; bytes?: number },
    signal?: AbortSignal
  ): AsyncIterable<Uint8Array>
}

/** Duck-typed LLM service seam for the model-faceable file handle (5a). */
interface LlmLike {
  fileRequestText?(ref: { attachmentId: string; name: string; bytes?: number }): string
}

interface SessionLike {
  id: unknown
  header?: { cwd?: string }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(JSON.stringify(body))
}

// ---- 失败可自救（0.5.4 普适性）---------------------------------------------
// 未知用户（LAN/域名部署、把服务放到反代后、附件超过上限）此前只拿到裸错误码，
// 无法判断「该改哪个配置键」。这些响应体在保留机器可读 error 码的同时附
// `hint`（可执行的一步）与 `detail`（现场数值），面板与 curl 都能直接照做。
// 文案英文单语：消费者是部署者 A（配置）与部署者 B（客户端提示），不随界面语言变。

const DOCS_URL = 'https://github.com/taxueseek/dsh-files#configuration'

/** One route failure: machine-readable code plus an actionable hint. */
export interface RouteFailure {
  error: string
  hint: string
  docs: string
  detail?: Record<string, unknown>
}

export function failurePayload(
  error: string,
  hint: string,
  detail?: Record<string, unknown>
): RouteFailure {
  return detail === undefined
    ? { error, hint, docs: DOCS_URL }
    : { error, hint, docs: DOCS_URL, detail }
}

/**
 * 403 body for the browser-trust fence. `host` is the rejected `Host` value
 * verbatim, so the operator can copy it straight into `trustedHosts`; the
 * detail also carries the current allow-list, because the usual failure is a
 * port mismatch after the deployment moved (dsh.example.com:3080 → :8443).
 */
export function hostNotTrustedPayload(
  host: string,
  trustedHosts: readonly string[]
): RouteFailure {
  return failurePayload(
    'host-not-trusted',
    `Browser host "${host}" is not loopback and not in trustedHosts. Add it to the plugin config (same semantics as the host's --trusted-host): trustedHosts: [${JSON.stringify(host)}]. Loopback deployments need no configuration.`,
    { host, trustedHosts: [...trustedHosts] }
  )
}

/** 413 body: the exact size/cap so "how much smaller" needs no guessing. */
export function tooLargePayload(
  action: 'download' | 'export',
  name: string | undefined,
  size: number,
  cap: number
): RouteFailure {
  const who = name === undefined ? 'This attachment' : `"${name}"`
  return failurePayload(
    'attachment-too-large',
    `${who} is ${formatBytes(size)} but the ${action} cap is ${formatBytes(cap)}. Raise maxDownloadBytes in the plugin config, or use the other transfer path (download keeps the file on the client, export writes it into the session workspace).`,
    { name, size, bytes: size, cap, maxDownloadBytes: cap, action }
  )
}

/** 标准查询串解析（URLSearchParams 语义，`+` 即空格）。手写 indexOf 切分
 * 虽然当前恰好安全（先切分后解码），但语义分歧埋在未来；标准库三行替代。 */
function queryParam(url: string | undefined, name: string): string | undefined {
  if (url === undefined) return undefined
  const raw = new URL(url, 'http://local').searchParams.get(name)
  const value = raw?.trim()
  return value === '' || value === 'undefined' ? undefined : value
}

/** Find one library entry by its normalized reference. */
async function findEntry(config: AttachmentLoopConfig, normalizedRef: string) {
  const all = await listAttachments(config.attachmentsDir)
  return all.find((e) => `sha256:${e.sha}` === normalizedRef)
}

/**
 * Model-faceable handle text for one entry when the LLM seam exposes it,
 * used by the @ source's 5a insertion. Falls back to undefined when the
 * service is absent, so the @ source simply hides the row's reference action.
 */
export function handleText(llm: LlmLike | undefined, sha: string, name: string, bytes: number): string | undefined {
  if (llm === undefined) return undefined
  try {
    return llm.fileRequestText?.({ attachmentId: `sha256:${sha}`, name, bytes })
  } catch {
    return undefined
  }
}

/** One page of the library list with totals (pure over the scan result). */
export function pageOf(
  entries: Array<{ name: string; sha: string; bytes: number; modifiedMs: number }>,
  q: string | undefined,
  limit: number,
  offset: number
): { rows: unknown[]; total: number; totalBytes: number } {
  const query = q?.trim().toLowerCase() ?? ''
  const filtered = query === '' ? entries : entries.filter((e) => e.name.toLowerCase().includes(query))
  const totalBytes = filtered.reduce((sum, e) => sum + e.bytes, 0)
  return { rows: filtered.slice(offset, offset + limit), total: filtered.length, totalBytes }
}

/**
 * Copy one attachment into `<cwd>/attachments/` with a collision-safe name.
 * Bytes come from the official store stream; the destination write is a
 * host-side action (panel button), not a model tool, so no fs observations.
 */
export async function exportToWorkspace(
  config: AttachmentLoopConfig,
  attachments: AttachmentStoreLike,
  entry: { name: string; sha: string; bytes: number },
  cwd: string
): Promise<string> {
  const destDir = join(cwd, 'attachments')
  await fsp.mkdir(destDir, { recursive: true })
  let base = sanitizeFileNameForPath(entry.name)
  if (base === '' || base === 'download') base = `attachment-${entry.sha.slice(0, 8)}`
  if (base.length > MAX_SAFE_NAME) base = base.slice(0, MAX_SAFE_NAME)
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let name = `${stem}${ext}`
  let counter = 1
  for (;;) {
    try {
      await fsp.access(join(destDir, name))
      name = `${stem}-${counter}${ext}`
      counter += 1
    } catch {
      break
    }
  }
  const dest = join(destDir, name)
  // 流式写：官方 seam 本身就是 AsyncIterable，全量缓冲再 concat 会让
  // maxDownloadBytes（默认 200 MiB）级的附件吃掉双倍堆。失败时清掉半个
  // 文件，不在工作区留残骸。
  try {
    await pipeline(
      Readable.from(attachments.readFileStream({
        attachmentId: `sha256:${entry.sha}`,
        name: entry.name,
        bytes: entry.bytes
      })),
      createWriteStream(dest)
    )
  } catch (error) {
    await fsp.rm(dest, { force: true }).catch(() => {})
    throw error
  }
  return `attachments/${name}`
}

export interface AttachmentLoopDeps {
  attachments?: AttachmentStoreLike
  llm?: LlmLike
  sessions?: { get(id: string): SessionLike | undefined }
}

export function registerAttachmentRoutes(
  ctx: {
    webServer: {
      register(route: {
        kind: 'exact' | 'prefix'
        path: string
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
      }): () => void
    }
  },
  deps: AttachmentLoopDeps,
  config: AttachmentLoopConfig
): void {
  const fence = (req: IncomingMessage, res: ServerResponse): boolean => {
    if (isTrustedRequest({ headers: req.headers as { host?: string } }, config.trustedHosts)) return true
    const authority = req.headers.host
    json(res, 403, hostNotTrustedPayload(typeof authority === 'string' ? authority : '(missing)', config.trustedHosts))
    return false
  }
  const queryInt = (url: string | undefined, name: string, fallback: number, max: number): number => {
    const raw = queryParam(url, name)
    if (raw === undefined) return fallback
    const value = Number(raw)
    if (!Number.isInteger(value) || value < 0) return fallback
    return Math.min(value, max)
  }

  // ---- GET /plugins/dsh-files/attachments?q=&limit=&offset= ----
  ctx.webServer.register({
    kind: 'exact',
    path: `${BASE}/attachments`,
    handler: async (req, res) => {
      if (!fence(req, res)) return
      const url = req.url ?? ''
      const q = queryParam(url, 'q')
      const limit = queryInt(url, 'limit', 100, 500)
      const offset = queryInt(url, 'offset', 0, 100000)
      try {
        const all = await listAttachments(config.attachmentsDir)
        const page = pageOf(all, q, limit, offset)
        const rows = page.rows.map((entry) => {
          const { name, sha, bytes, modifiedMs } = entry as { name: string; sha: string; bytes: number; modifiedMs: number }
          return {
            name,
            sha,
            bytes,
            modifiedMs,
            ref: `sha256:${sha}`,
            handle: handleText(deps.llm, sha, name, bytes)
          }
        })
        json(res, 200, { rows, total: page.total, totalBytes: page.totalBytes })
      } catch (error) {
        json(res, 500, failurePayload(
          'list-failed',
          `The attachment library at ${config.attachmentsDir} could not be read. Check that the directory exists and is readable, or point attachmentsDir at the real library root. Reason: ${error instanceof Error ? error.message : 'unknown error'}`
        ))
      }
    }
  })

  // ---- GET /plugins/dsh-files/attachments/download?ref=sha256:… ----
  const attachments = deps.attachments
  if (attachments !== undefined) {
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/attachments/download`,
      handler: async (req, res) => {
        if (!fence(req, res)) return
        const ref = queryParam(req.url, 'ref')
        const normalized = ref === undefined ? undefined : normalizeAttachmentRef(ref)
        if (normalized === undefined) {
          json(res, 400, failurePayload(
            'invalid-ref',
            'The ref query parameter must be a content reference of the form sha256:<64 hex digits>, exactly as returned in the "ref" field of GET /plugins/dsh-files/attachments.'
          ))
          return
        }
        const entry = await findEntry(config, normalized)
        if (entry === undefined) {
          json(res, 404, failurePayload(
            'attachment-not-found',
            'No attachment in the library carries that content reference. List them first with GET /plugins/dsh-files/attachments and use its "ref" field.'
          ))
          return
        }
        if (entry.bytes > config.maxDownloadBytes) {
          json(res, 413, tooLargePayload('download', entry.name, entry.bytes, config.maxDownloadBytes))
          return
        }
        const filename = sanitizeDownloadName(entry.name)
        // RFC 5987: ASCII fallback + UTF-8 filename* so Chinese names survive.
        const utf8Name = entry.name
          .replace(/[\u0000-\u001f\u007f-\u009f"\\]/g, '_')
          .replace(/\s+/g, ' ')
          .slice(0, MAX_SAFE_NAME)
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': String(entry.bytes),
          'content-disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`,
          'cache-control': 'no-store'
        })
        try {
          for await (const chunk of attachments.readFileStream({
            attachmentId: normalized,
            name: entry.name,
            bytes: entry.bytes
          })) {
            if (!res.write(chunk)) {
              await new Promise<void>((resolve) => res.once('drain', resolve))
            }
          }
          res.end()
        } catch (error) {
          if (res.headersSent) {
            res.destroy()
            return
          }
          const code = (error as { code?: string }).code
          if (code === 'ATTACHMENT_NOT_FOUND') {
            json(res, 404, failurePayload(
              'attachment-object-missing',
              'The library index lists this attachment but its stored object is gone. Re-upload the file, or export a different one.'
            ))
          } else if (code === 'ATTACHMENT_CORRUPT') {
            json(res, 409, failurePayload(
              'attachment-corrupt',
              'The stored bytes failed the content-integrity check, so the object is damaged. Re-upload the source file instead of retrying this transfer.'
            ))
          } else {
            json(res, 500, failurePayload(
              'attachment-read-failed',
              'The attachment store could not stream these bytes. Retry once; if it persists, export to the workspace instead of downloading.'
            ))
          }
        }
      }
    })
  }

  // ---- POST /plugins/dsh-files/attachments/export?session=&ref= ----
  // 5b fallback: the panel copies one attachment into the current session
  // workspace (`attachments/<name>`) so the agent's read/edit/bash reach it.
  const sessions = deps.sessions
  if (attachments !== undefined && sessions !== undefined) {
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/attachments/export`,
      handler: async (req, res) => {
        if (!fence(req, res)) return
        if (req.method !== 'POST') {
          // 405 也走同一失败契约：裸 405 对调用方没有任何可照做的信息。
          res.writeHead(405, { allow: 'POST', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify(failurePayload(
            'method-not-allowed',
            'Export is a POST route. Send the same URL with -X POST (the panel does this for you); a GET never exports.'
          )))
          return
        }
        const url = req.url ?? ''
        const sessionId = queryParam(url, 'session')
        const ref = queryParam(url, 'ref')
        const normalized = ref === undefined ? undefined : normalizeAttachmentRef(ref)
        if (sessionId === undefined || normalized === undefined) {
          json(res, 400, failurePayload(
            'missing-parameters',
            'Export needs both query parameters: session=<session id> and ref=sha256:<64 hex digits>. The panel supplies them; a manual call must pass both.'
          ))
          return
        }
        const entry = await findEntry(config, normalized)
        if (entry === undefined) {
          json(res, 404, failurePayload(
            'attachment-not-found',
            'No attachment in the library carries that content reference. List them first with GET /plugins/dsh-files/attachments and use its "ref" field.'
          ))
          return
        }
        if (entry.bytes > config.maxDownloadBytes) {
          json(res, 413, tooLargePayload('export', entry.name, entry.bytes, config.maxDownloadBytes))
          return
        }
        const session = sessions.get(sessionId)
        const cwd = session?.header?.cwd
        if (typeof cwd !== 'string' || cwd === '') {
          json(res, 400, failurePayload(
            'session-without-workspace',
            'That session has no workspace directory, so there is nowhere to export into. Open a session bound to a workspace (or set one for this session) and retry.'
          ))
          return
        }
        try {
          const relativePath = await exportToWorkspace(config, attachments, entry, cwd)
          json(res, 200, { relativePath })
        } catch (error) {
          json(res, 500, failurePayload(
            'export-failed',
            `The attachment could not be written into the session workspace. Check that the workspace directory is writable. Reason: ${error instanceof Error ? error.message : 'unknown error'}`
          ))
        }
      }
    })
  }
}
