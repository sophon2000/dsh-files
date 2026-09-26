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
import { createWriteStream } from 'node:fs';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { listAttachments } from "./attachments.js";
import { isTrustedRequest } from "./attachments/fence.js";
import { normalizeAttachmentRef, sanitizeDownloadName, sanitizeFileNameForPath, MAX_SAFE_NAME } from "./attachments/ref.js";
const BASE = '/plugins/dsh-files';
function json(res, status, body) {
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
    });
    res.end(JSON.stringify(body));
}
/** 标准查询串解析（URLSearchParams 语义，`+` 即空格）。手写 indexOf 切分
 * 虽然当前恰好安全（先切分后解码），但语义分歧埋在未来；标准库三行替代。 */
function queryParam(url, name) {
    if (url === undefined)
        return undefined;
    const raw = new URL(url, 'http://local').searchParams.get(name);
    const value = raw?.trim();
    return value === '' || value === 'undefined' ? undefined : value;
}
/** Find one library entry by its normalized reference. */
async function findEntry(config, normalizedRef) {
    const all = await listAttachments(config.attachmentsDir);
    return all.find((e) => `sha256:${e.sha}` === normalizedRef);
}
/**
 * Model-faceable handle text for one entry when the LLM seam exposes it,
 * used by the @ source's 5a insertion. Falls back to undefined when the
 * service is absent, so the @ source simply hides the row's reference action.
 */
export function handleText(llm, sha, name, bytes) {
    if (llm === undefined)
        return undefined;
    try {
        return llm.fileRequestText?.({ attachmentId: `sha256:${sha}`, name, bytes });
    }
    catch {
        return undefined;
    }
}
/** One page of the library list with totals (pure over the scan result). */
export function pageOf(entries, q, limit, offset) {
    const query = q?.trim().toLowerCase() ?? '';
    const filtered = query === '' ? entries : entries.filter((e) => e.name.toLowerCase().includes(query));
    const totalBytes = filtered.reduce((sum, e) => sum + e.bytes, 0);
    return { rows: filtered.slice(offset, offset + limit), total: filtered.length, totalBytes };
}
/**
 * Copy one attachment into `<cwd>/attachments/` with a collision-safe name.
 * Bytes come from the official store stream; the destination write is a
 * host-side action (panel button), not a model tool, so no fs observations.
 */
export async function exportToWorkspace(config, attachments, entry, cwd) {
    const destDir = join(cwd, 'attachments');
    await fsp.mkdir(destDir, { recursive: true });
    let base = sanitizeFileNameForPath(entry.name);
    if (base === '' || base === 'download')
        base = `attachment-${entry.sha.slice(0, 8)}`;
    if (base.length > MAX_SAFE_NAME)
        base = base.slice(0, MAX_SAFE_NAME);
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    let name = `${stem}${ext}`;
    let counter = 1;
    for (;;) {
        try {
            await fsp.access(join(destDir, name));
            name = `${stem}-${counter}${ext}`;
            counter += 1;
        }
        catch {
            break;
        }
    }
    const dest = join(destDir, name);
    // 流式写：官方 seam 本身就是 AsyncIterable，全量缓冲再 concat 会让
    // maxDownloadBytes（默认 200 MiB）级的附件吃掉双倍堆。失败时清掉半个
    // 文件，不在工作区留残骸。
    try {
        await pipeline(Readable.from(attachments.readFileStream({
            attachmentId: `sha256:${entry.sha}`,
            name: entry.name,
            bytes: entry.bytes
        })), createWriteStream(dest));
    }
    catch (error) {
        await fsp.rm(dest, { force: true }).catch(() => { });
        throw error;
    }
    return `attachments/${name}`;
}
export function registerAttachmentRoutes(ctx, deps, config) {
    const fence = (req, res) => {
        if (isTrustedRequest({ headers: req.headers }, config.trustedHosts))
            return true;
        json(res, 403, { error: 'forbidden' });
        return false;
    };
    const queryInt = (url, name, fallback, max) => {
        const raw = queryParam(url, name);
        if (raw === undefined)
            return fallback;
        const value = Number(raw);
        if (!Number.isInteger(value) || value < 0)
            return fallback;
        return Math.min(value, max);
    };
    // ---- GET /plugins/dsh-files/attachments?q=&limit=&offset= ----
    ctx.webServer.register({
        kind: 'exact',
        path: `${BASE}/attachments`,
        handler: async (req, res) => {
            if (!fence(req, res))
                return;
            const url = req.url ?? '';
            const q = queryParam(url, 'q');
            const limit = queryInt(url, 'limit', 100, 500);
            const offset = queryInt(url, 'offset', 0, 100000);
            try {
                const all = await listAttachments(config.attachmentsDir);
                const page = pageOf(all, q, limit, offset);
                const rows = page.rows.map((entry) => {
                    const { name, sha, bytes, modifiedMs } = entry;
                    return {
                        name,
                        sha,
                        bytes,
                        modifiedMs,
                        ref: `sha256:${sha}`,
                        handle: handleText(deps.llm, sha, name, bytes)
                    };
                });
                json(res, 200, { rows, total: page.total, totalBytes: page.totalBytes });
            }
            catch (error) {
                json(res, 500, { error: error instanceof Error ? error.message : 'list failed' });
            }
        }
    });
    // ---- GET /plugins/dsh-files/attachments/download?ref=sha256:… ----
    const attachments = deps.attachments;
    if (attachments !== undefined) {
        ctx.webServer.register({
            kind: 'exact',
            path: `${BASE}/attachments/download`,
            handler: async (req, res) => {
                if (!fence(req, res))
                    return;
                const ref = queryParam(req.url, 'ref');
                const normalized = ref === undefined ? undefined : normalizeAttachmentRef(ref);
                if (normalized === undefined) {
                    json(res, 400, { error: 'invalid ref' });
                    return;
                }
                const entry = await findEntry(config, normalized);
                if (entry === undefined) {
                    json(res, 404, { error: 'attachment not found' });
                    return;
                }
                if (entry.bytes > config.maxDownloadBytes) {
                    json(res, 413, { error: 'attachment exceeds the download cap', size: entry.bytes });
                    return;
                }
                const filename = sanitizeDownloadName(entry.name);
                // RFC 5987: ASCII fallback + UTF-8 filename* so Chinese names survive.
                const utf8Name = entry.name
                    .replace(/[\u0000-\u001f\u007f-\u009f"\\]/g, '_')
                    .replace(/\s+/g, ' ')
                    .slice(0, MAX_SAFE_NAME);
                res.writeHead(200, {
                    'content-type': 'application/octet-stream',
                    'content-length': String(entry.bytes),
                    'content-disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`,
                    'cache-control': 'no-store'
                });
                try {
                    for await (const chunk of attachments.readFileStream({
                        attachmentId: normalized,
                        name: entry.name,
                        bytes: entry.bytes
                    })) {
                        if (!res.write(chunk)) {
                            await new Promise((resolve) => res.once('drain', resolve));
                        }
                    }
                    res.end();
                }
                catch (error) {
                    if (res.headersSent) {
                        res.destroy();
                        return;
                    }
                    const code = error.code;
                    if (code === 'ATTACHMENT_NOT_FOUND')
                        json(res, 404, { error: 'attachment object missing' });
                    else if (code === 'ATTACHMENT_CORRUPT')
                        json(res, 409, { error: 'attachment integrity check failed' });
                    else
                        json(res, 500, { error: 'attachment read failed' });
                }
            }
        });
    }
    // ---- POST /plugins/dsh-files/attachments/export?session=&ref= ----
    // 5b fallback: the panel copies one attachment into the current session
    // workspace (`attachments/<name>`) so the agent's read/edit/bash reach it.
    const sessions = deps.sessions;
    if (attachments !== undefined && sessions !== undefined) {
        ctx.webServer.register({
            kind: 'exact',
            path: `${BASE}/attachments/export`,
            handler: async (req, res) => {
                if (!fence(req, res))
                    return;
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST' });
                    res.end();
                    return;
                }
                const url = req.url ?? '';
                const sessionId = queryParam(url, 'session');
                const ref = queryParam(url, 'ref');
                const normalized = ref === undefined ? undefined : normalizeAttachmentRef(ref);
                if (sessionId === undefined || normalized === undefined) {
                    json(res, 400, { error: 'session and ref are required' });
                    return;
                }
                const entry = await findEntry(config, normalized);
                if (entry === undefined) {
                    json(res, 404, { error: 'attachment not found' });
                    return;
                }
                if (entry.bytes > config.maxDownloadBytes) {
                    json(res, 413, { error: 'attachment exceeds the export cap', size: entry.bytes });
                    return;
                }
                const session = sessions.get(sessionId);
                const cwd = session?.header?.cwd;
                if (typeof cwd !== 'string' || cwd === '') {
                    json(res, 400, { error: 'session has no workspace cwd' });
                    return;
                }
                try {
                    const relativePath = await exportToWorkspace(config, attachments, entry, cwd);
                    json(res, 200, { relativePath });
                }
                catch (error) {
                    json(res, 500, { error: error instanceof Error ? error.message : 'export failed' });
                }
            }
        });
    }
}
