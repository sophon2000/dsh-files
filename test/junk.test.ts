// 文件夹上传的垃圾过滤矩阵：锁文件/隐藏文件/系统文件必须跳过，正常文件
// 不得误伤。splitJunk 的可见性契约（junkCount）同样被锁定。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isJunkPath, splitJunk } from '../src/client/junk.ts'

test('office lock files are junk', () => {
  assert.equal(isJunkPath('~$条例.docx'), true)
  assert.equal(isJunkPath('docs/~$条例.docx'), true)
  assert.equal(isJunkPath('.~23.9.1三明市城市养犬管理条例.doc'), true)
  assert.equal(isJunkPath('~WRL1234.tmp'), true)
})

test('hidden files and dotfiles are junk (privacy boundary: .env)', () => {
  assert.equal(isJunkPath('.DS_Store'), true)
  assert.equal(isJunkPath('sub/.DS_Store'), true)
  assert.equal(isJunkPath('._resource.jpg'), true)
  assert.equal(isJunkPath('.env'), true)
  assert.equal(isJunkPath('.gitignore'), true)
})

test('windows/macOS system files are junk', () => {
  assert.equal(isJunkPath('Thumbs.db'), true)
  assert.equal(isJunkPath('thumbs.DB'), true)
  assert.equal(isJunkPath('desktop.ini'), true)
  assert.equal(isJunkPath('Icon\r'), true)
})

test('normal files are not junk', () => {
  assert.equal(isJunkPath('中华人民共和国大气污染防治法.doc'), false)
  assert.equal(isJunkPath('docs/报告 v2.pdf'), false)
  assert.equal(isJunkPath('notes~draft.md'), false)
  assert.equal(isJunkPath('my.env backup.txt'), false)
})

test('splitJunk partitions and counts without mutating input', () => {
  const files = [
    { name: 'a.pdf' },
    { name: '~$b.docx' },
    { name: 'c.txt', webkitRelativePath: 'pack/c.txt' },
    { name: '.DS_Store', webkitRelativePath: 'pack/.DS_Store' }
  ]
  const { keep, junkCount } = splitJunk(files)
  assert.deepEqual(keep.map((f) => f.name), ['a.pdf', 'c.txt'])
  assert.equal(junkCount, 2)
  assert.equal(files.length, 4)
})

test('empty basename is junk', () => {
  assert.equal(isJunkPath(''), true)
  assert.equal(isJunkPath('dir/'), true)
})
