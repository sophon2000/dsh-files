import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const hostVersion = '0.2.0-rc.2.vh.1'

test('development and runtime peers use one exact rc2 fork family', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.version, '0.5.3-vh.2')
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
