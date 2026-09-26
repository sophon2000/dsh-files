// 面板列表纯函数：客户端过滤与显示上限（搜索不再打服务端往返）。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayRows, filterRows, DISPLAY_CAP } from '../src/client/rows.ts'

const rows = [
  { name: '报告.docx' },
  { name: '合同扫描件.PDF' },
  { name: 'notes.txt' }
]

test('filterRows 不区分大小写的包含匹配', () => {
  assert.deepEqual(filterRows(rows, 'pdf').map((r) => r.name), ['合同扫描件.PDF'])
  assert.deepEqual(filterRows(rows, 'NOTE').map((r) => r.name), ['notes.txt'])
})

test('filterRows 空查询原样返回且不泄漏内部数组', () => {
  const out = filterRows(rows, '  ')
  assert.equal(out.length, 3)
  assert.notEqual(out, rows)
})

test('displayRows 截断并报告隐藏数', () => {
  const many = Array.from({ length: DISPLAY_CAP + 7 }, (_, i) => ({ name: `f${i}` }))
  const page = displayRows(many, '')
  assert.equal(page.rows.length, DISPLAY_CAP)
  assert.equal(page.hidden, 7)
})

test('displayRows 先过滤后截断', () => {
  const many = Array.from({ length: DISPLAY_CAP + 7 }, (_, i) => ({ name: i < 3 ? 'keep-me' : `f${i}` }))
  const page = displayRows(many, 'keep-me')
  assert.equal(page.rows.length, 3)
  assert.equal(page.hidden, 0)
})
