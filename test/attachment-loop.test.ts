// Attachment loop unit tests: fence, reference normalization, filename
// sanitation, handle text and list paging. All pure functions (no I/O).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedRequest } from '../src/attachments/fence.ts'
import { normalizeAttachmentRef, shaOf, sanitizeDownloadName, sanitizeFileNameForPath } from '../src/attachments/ref.ts'
import { failurePayload, handleText, hostNotTrustedPayload, pageOf, registerAttachmentRoutes, tooLargePayload } from '../src/attachment-loop.ts'

const SHA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

// ---------------- fence ----------------

test('loopback authorities are always trusted', () => {
  for (const host of ['127.0.0.1:3080', '127.0.0.1', 'localhost:3080', '[::1]:3080']) {
    assert.equal(isTrustedRequest({ headers: { host } }, []), true, host)
  }
})

test('public hosts are denied without trustedHosts', () => {
  assert.equal(isTrustedRequest({ headers: { host: 'dsh.example.com:3080' } }, []), false)
  assert.equal(isTrustedRequest({ headers: { host: 'example.com' } }, []), false)
})

test('bare trustedHost entry matches any port, host:port matches exactly', () => {
  assert.equal(isTrustedRequest({ headers: { host: 'dsh.example.com:3080' } }, ['dsh.example.com']), true)
  assert.equal(isTrustedRequest({ headers: { host: 'dsh.example.com:8080' } }, ['dsh.example.com']), true)
  assert.equal(isTrustedRequest({ headers: { host: 'dsh.example.com:3080' } }, ['dsh.example.com:3080']), true)
  assert.equal(isTrustedRequest({ headers: { host: 'dsh.example.com:8080' } }, ['dsh.example.com:3080']), false)
})

test('missing Host header is denied', () => {
  assert.equal(isTrustedRequest({ headers: {} }, []), false)
  assert.equal(isTrustedRequest({ headers: { host: '' } }, []), false)
})

test('same host, different name is denied (DNS rebinding shape)', () => {
  assert.equal(isTrustedRequest({ headers: { host: 'dsh.example.com.evil.com' } }, ['dsh.example.com']), false)
})

// ---------------- route-level: the fence really uses the actionable body ----------------

/** Minimal route-recording webServer stub: capture handlers, build fake req/res. */
function recordingServer() {
  const routes = new Map<string, (req: unknown, res: unknown) => void | Promise<void>>()
  const webServer = {
    register(route: { path: string; handler: (req: never, res: never) => void | Promise<void> }) {
      routes.set(route.path, route.handler as (req: unknown, res: unknown) => void | Promise<void>)
      return () => routes.delete(route.path)
    }
  }
  const call = async (path: string, headers: Record<string, string>) => {
    const handler = routes.get(path)
    assert.ok(handler !== undefined, `route ${path} must be registered`)
    let status = 0
    let body = ''
    const res = {
      writeHead(code: number) { status = code; return res },
      end(chunk?: string) { if (chunk !== undefined) body += chunk; return res },
      // 未授权分支必须在写出任何字节前收口（无 headersSent、无流式写入）
      write() { throw new Error('fence must not write a body stream on 403') },
      once() { return res },
      destroy() {}
    }
    await handler({ url: path, method: 'GET', headers }, res)
    return { status, body: body === '' ? undefined : JSON.parse(body) as Record<string, unknown> }
  }
  return { webServer, call }
}

test('403 from the real fence names the authority and the config key (not a bare "forbidden")', async () => {
  const { webServer, call } = recordingServer()
  registerAttachmentRoutes(
    { webServer },
    {},
    { attachmentsDir: '/nonexistent', maxDownloadBytes: 1024, trustedHosts: ['dsh.example.com:3080'] }
  )
  const { status, body } = await call('/plugins/dsh-files/attachments', { host: 'dsh.example.com:8443' })
  assert.equal(status, 403)
  assert.equal(body?.error, 'host-not-trusted')
  assert.ok(String(body?.hint).includes('"dsh.example.com:8443"'), String(body?.hint))
  assert.deepEqual((body?.detail as { trustedHosts?: unknown })?.trustedHosts, ['dsh.example.com:3080'])
})

test('the export route answers a wrong method with the same contract, not a bare 405', async () => {
  const { webServer, call } = recordingServer()
  const streams: Uint8Array[] = []
  registerAttachmentRoutes(
    { webServer },
    { attachments: { async *readFileStream() { streams.push(new Uint8Array()) } }, sessions: { get: () => undefined } },
    { attachmentsDir: '/nonexistent', maxDownloadBytes: 1024, trustedHosts: [] }
  )
  const { status, body } = await call('/plugins/dsh-files/attachments/export', { host: '127.0.0.1:3080' })
  assert.equal(status, 405)
  assert.equal(body?.error, 'method-not-allowed')
  assert.ok(String(body?.hint).includes('POST'), String(body?.hint))
  // 绝不能因为方法错就去碰附件存储
  assert.equal(streams.length, 0)
})

test('loopback reaches the list handler and is never answered by the fence', async () => {
  const { webServer, call } = recordingServer()
  registerAttachmentRoutes(
    { webServer },
    {},
    { attachmentsDir: '/nonexistent', maxDownloadBytes: 1024, trustedHosts: [] }
  )
  const { status } = await call('/plugins/dsh-files/attachments', { host: '127.0.0.1:3080' })
  // 目录不存在按空清单处理，故不是 403——证明围栏放行
  assert.equal(status, 200)
})

// ---------------- failure payloads (自我诊断) ----------------

test('every route failure carries a code, an actionable hint and the docs anchor', () => {
  for (const payload of [
    failurePayload('x', 'do this'),
    hostNotTrustedPayload('dsh.example.com:3080', []),
    tooLargePayload('download', 'a.pdf', 300, 200)
  ]) {
    assert.equal(typeof payload.error, 'string')
    assert.ok(payload.error.length > 0)
    assert.ok(payload.hint.length > 0, payload.error)
    assert.match(payload.docs, /#configuration$/)
  }
})

test('the 403 body names the rejected authority so it can be copy-pasted into trustedHosts', () => {
  const payload = hostNotTrustedPayload('dsh.example.com:8443', ['dsh.example.com:3080'])
  assert.equal(payload.error, 'host-not-trusted')
  // 可照做：hint 里必须出现原样引用待放行的 authority
  assert.ok(payload.hint.includes('"dsh.example.com:8443"'), payload.hint)
  assert.ok(payload.hint.includes('trustedHosts'), payload.hint)
  // 并给出当前白名单，便于看出「端口搬了」这一类失效
  assert.deepEqual(payload.detail?.trustedHosts, ['dsh.example.com:3080'])
})

test('a missing Host header is reported honestly, not as an empty authority', () => {
  assert.equal(hostNotTrustedPayload('(missing)', []).detail?.host, '(missing)')
})

test('the 413 body states real size, cap and the config key to raise', () => {
  const payload = tooLargePayload('export', '《长文档》.pdf', 300 * 1024 * 1024, 200 * 1024 * 1024)
  assert.equal(payload.error, 'attachment-too-large')
  assert.equal(payload.detail?.maxDownloadBytes, 200 * 1024 * 1024)
  assert.ok(payload.hint.includes('300.0 MB'), payload.hint)
  assert.ok(payload.hint.includes('200.0 MB'), payload.hint)
  assert.ok(payload.hint.includes('maxDownloadBytes'), payload.hint)
  // 中文名照原样带出，便于用户对上号
  assert.ok(payload.hint.includes('《长文档》.pdf'), payload.hint)
})

test('413 hint names the path that actually failed (export vs download)', () => {
  assert.ok(tooLargePayload('export', 'a.bin', 2, 1).hint.includes('export cap'))
  assert.ok(tooLargePayload('download', 'a.bin', 2, 1).hint.includes('download cap'))
})

test('an unknown attachment name still yields a readable 413 sentence', () => {
  const payload = tooLargePayload('download', undefined, 2, 1)
  assert.ok(payload.hint.startsWith('This attachment is'), payload.hint)
})

// ---------------- reference normalization ----------------

test('bare 64-hex sha normalizes to sha256: prefix', () => {
  assert.equal(normalizeAttachmentRef(SHA), `sha256:${SHA}`)
})

test('sha256-prefixed form passes through', () => {
  assert.equal(normalizeAttachmentRef(`sha256:${SHA}`), `sha256:${SHA}`)
})

test('short, mixed-case and non-hex input are rejected', () => {
  assert.equal(normalizeAttachmentRef(SHA.slice(0, 8)), undefined)
  assert.equal(normalizeAttachmentRef('g'.repeat(64)), undefined)
  assert.equal(normalizeAttachmentRef(`sha256:${'g'.repeat(64)}`), undefined)
  assert.equal(normalizeAttachmentRef(''), undefined)
  assert.equal(normalizeAttachmentRef('../etc/passwd'), undefined)
})

test('shaOf extracts the bare hex', () => {
  assert.equal(shaOf(SHA), SHA)
  assert.equal(shaOf(`sha256:${SHA}`), SHA)
  assert.equal(shaOf('nope'), undefined)
})

// ---------------- filename sanitation ----------------

test('CRLF / quote / backslash cannot break the header', () => {
  assert.equal(sanitizeDownloadName('a\r\nb'), 'a__b') // each control char becomes _
  assert.equal(sanitizeDownloadName('evil"name.pdf'), 'evil_name.pdf')
  assert.equal(sanitizeDownloadName('back\\slash.txt'), 'back_slash.txt')
  assert.equal(sanitizeDownloadName('../../etc/passwd'), '.._.._etc_passwd') // separators become _, dots stay
})

test('non-ASCII names keep a safe ASCII fallback', () => {
  const fallback = sanitizeDownloadName('合同 2026.docx')
  assert.ok(/^[\x20-\x7e]+$/.test(fallback))
  assert.ok(fallback.endsWith('.docx'))
})

test('empty and whitespace names fall back to download', () => {
  assert.equal(sanitizeDownloadName(''), 'download')
  assert.equal(sanitizeDownloadName('   '), 'download')
})

test('overlong names are capped', () => {
  assert.ok(sanitizeDownloadName('x'.repeat(500)).length <= 120)
})

// ---------------- path-name sanitation (export) ----------------

test('path names keep Unicode but drop separators, controls and leading dots', () => {
  assert.equal(sanitizeFileNameForPath('合同 2026.docx'), '合同 2026.docx')
  assert.equal(sanitizeFileNameForPath('../a\\b.pdf'), 'a_b.pdf')
  assert.equal(sanitizeFileNameForPath('.env'), 'env')
  assert.equal(sanitizeFileNameForPath('a\u0000b.txt'), 'a_b.txt')
})

test('path names never empty', () => {
  const fallback = sanitizeFileNameForPath('../..')
  assert.ok(fallback.startsWith('attachment-'))
})

// ---------------- handle text ----------------

test('handleText returns the LLM seam text when available', () => {
  const llm = { fileRequestText: (ref: { name: string }) => `FILE ${ref.name}` }
  assert.equal(handleText(llm, SHA, 'a.pdf', 10), 'FILE a.pdf')
})

test('handleText is undefined without the seam or when it throws', () => {
  assert.equal(handleText(undefined, SHA, 'a.pdf', 10), undefined)
  const throwing = { fileRequestText: () => { throw new Error('boom') } }
  assert.equal(handleText(throwing, SHA, 'a.pdf', 10), undefined)
})

// ---------------- list paging ----------------

const ENTRIES = [
  { name: 'b.pdf', sha: 'b'.repeat(64), bytes: 100, modifiedMs: 3 },
  { name: 'a.txt', sha: 'a'.repeat(64), bytes: 50, modifiedMs: 2 },
  { name: 'c.md', sha: 'c'.repeat(64), bytes: 25, modifiedMs: 1 }
]

test('pageOf filters by name substring and totals the filtered set', () => {
  const page = pageOf(ENTRIES, 'a', 10, 0)
  assert.equal(page.total, 1)
  assert.equal(page.totalBytes, 50)
  assert.equal((page.rows[0] as { name: string }).name, 'a.txt')
})

test('pageOf paginates and keeps order', () => {
  const first = pageOf(ENTRIES, undefined, 2, 0)
  assert.equal(first.total, 3)
  assert.equal(first.rows.length, 2)
  const second = pageOf(ENTRIES, undefined, 2, 2)
  assert.equal(second.rows.length, 1)
  assert.equal((second.rows[0] as { name: string }).name, 'c.md')
})

test('pageOf totals are byte sums of the filtered set', () => {
  const page = pageOf(ENTRIES, '', 10, 0)
  assert.equal(page.totalBytes, 175)
})
