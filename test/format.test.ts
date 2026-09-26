// format.ts 是面板与模型工具的单一显示真源；这里锁住关键口径：
// ≥1 GiB 进 GB 两位小数（消灭「3072.0 MB vs 3.00 GB」类发散）、时间一律
// 本地时区。ts 部分通过 node 原生 type stripping 直接跑。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatBytes, formatTime, formatTimeShort } from '../src/format.ts'

test('formatBytes 分段与 GB 分支', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1023), '1023 B')
  assert.equal(formatBytes(1024), '1.0 KB')
  assert.equal(formatBytes(1024 * 1024), '1.0 MB')
  assert.equal(formatBytes(3 * 1024 * 1024 * 1024), '3.00 GB')
  assert.equal(formatBytes(900 * 1024 * 1024 * 1024), '900.00 GB')
  assert.equal(formatBytes(1024 * 1024 * 1024 - 1), '1024.0 MB')
})

test('formatTime 本地时区全量格式', () => {
  // 用本地时间构造，避免 CI 时区差：期望值与输入取同一本地字段。
  const d = new Date(2026, 8, 11, 14, 30) // 2026-09-11 14:30 本地
  assert.equal(formatTime(d.getTime()), '2026-09-11 14:30')
})

test('formatTimeShort 同年短格式、往年全日期', () => {
  const now = new Date()
  const sameYear = new Date(now.getFullYear(), 4, 2, 8, 5)
  assert.equal(formatTimeShort(sameYear.getTime()), '05-02 08:05')
  assert.equal(formatTimeShort(new Date(2020, 0, 9).getTime()), '2020-01-09')
})
