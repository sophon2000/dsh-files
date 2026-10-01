import { test } from 'node:test'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { access, readFile } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const hostVersion = '0.2.0-rc.2.vh.1'

test('development and runtime peers use one exact rc2 fork family', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.version, '0.5.5-vh.1')
  for (const name of ['@deepseek-ai/dsh-fs', '@deepseek-ai/dsh-tools']) {
    assert.equal(pkg.peerDependencies[name], hostVersion, `${name} runtime peer`)
  }
  const hostDependencies = Object.entries(pkg.devDependencies)
    .filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
  assert.ok(hostDependencies.length >= 2)
  for (const [name, version] of hostDependencies) {
    assert.equal(version, hostVersion, `${name} development pin`)
    assert.equal(require(`${name}/package.json`).version, hostVersion, `${name} installed version`)
  }
})


test('bilingual README records match the current paired files', async () => {
  const record = await readFile(new URL('../README.i18n.yaml', import.meta.url), 'utf8')
  for (const filename of ['README.md', 'README.zh.md']) {
    const bytes = await readFile(new URL(`../${filename}`, import.meta.url))
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
    assert.ok(record.split('\n').includes(`${filename}: ${hash}`), `${filename} consistency record`)
  }
})


test('upstream reconciliation preserves the read-only client and excludes attachment UI', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.deepEqual(pkg.dsh.client.inject, [])
  for (const group of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const name of ['react', '@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-ui-primitives']) {
      assert.equal(pkg[group]?.[name], undefined, `${group}: ${name} must stay outside this fork`)
    }
  }
  for (const filename of ['src/attachment-loop.ts', 'src/client/dock.tsx', 'src/client/index.tsx', 'lib/attachment-loop.js']) {
    await assert.rejects(access(new URL(`../${filename}`, import.meta.url)), { code: 'ENOENT' })
  }
})
