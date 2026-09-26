// Attachment loop unit tests: fence, reference normalization, filename
// sanitation, handle text and list paging. All pure functions (no I/O).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedRequest } from '../src/attachments/fence.ts'
import { normalizeAttachmentRef, shaOf, sanitizeDownloadName, sanitizeFileNameForPath } from '../src/attachments/ref.ts'
import { handleText, pageOf } from '../src/attachment-loop.ts'

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
