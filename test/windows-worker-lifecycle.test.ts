import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Removing the native binding's parent lifetime must reproduce a host crash,
// rather than merely changing a private implementation detail.
test('Windows parser workers can be replaced repeatedly without killing their host', {
  skip: process.platform !== 'win32', timeout: 35000,
}, async () => {
  const runner = new URL('../lib/parse/runner.js', import.meta.url).href
  const limits = new URL('../lib/parse/limits.js', import.meta.url).href
  const source = `
    import assert from 'node:assert/strict';
    const { runParser } = await import(${JSON.stringify(runner)});
    const { parseLimits } = await import(${JSON.stringify(limits)});
    for (let index = 0; index < 30; index++) {
      const result = await runParser({
        bytes: new TextEncoder().encode('unused\\nread-' + index), format: 'text',
        options: { sheetRowLimit: 200 }, limits: parseLimits(),
        offset: 2, limit: 1, maxOutputChars: 2000,
      }, new AbortController().signal);
      assert.equal(result.lines[0]?.text, 'read-' + index);
    }
    console.log(JSON.stringify({ completed: 30 }));
  `
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], {
    timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true,
  })
  assert.deepEqual(JSON.parse(stdout.trim()), { completed: 30 })
})

test('Windows parser binding selection ignores parent native-library overrides', {
  skip: process.platform !== 'win32', timeout: 10000,
}, async () => {
  const source = `
    import assert from 'node:assert/strict';
    const before = { path: process.env.NAPI_RS_NATIVE_LIBRARY_PATH, wasi: process.env.NAPI_RS_FORCE_WASI };
    const { runParser } = await import(${JSON.stringify(new URL('../lib/parse/runner.js', import.meta.url).href)});
    const { parseLimits } = await import(${JSON.stringify(new URL('../lib/parse/limits.js', import.meta.url).href)});
    const result = await runParser({ bytes: new TextEncoder().encode('read-with-parent-override'),
      format: 'text', options: { sheetRowLimit: 200 }, limits: parseLimits(),
      offset: 1, limit: 1, maxOutputChars: 2000 }, new AbortController().signal);
    assert.equal(result.lines[0]?.text, 'read-with-parent-override');
    assert.deepEqual({ path: process.env.NAPI_RS_NATIVE_LIBRARY_PATH, wasi: process.env.NAPI_RS_FORCE_WASI }, before);
    console.log('override ignored');
  `
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], {
    env: { ...process.env, NAPI_RS_NATIVE_LIBRARY_PATH: 'Z:/missing-reader-binding.node', NAPI_RS_FORCE_WASI: '1' },
    timeout: 8000, maxBuffer: 1024 * 1024, windowsHide: true,
  })
  assert.equal(stdout.trim(), 'override ignored')
})

for (const absent of ['canvas', 'native-binary']) {
  test(`Windows text reading works without optional ${absent}`, {
    skip: process.platform !== 'win32', timeout: 15000,
  }, async () => {
    // An isolated dependency tree exercises real PDF.js optional-dependency
    // handling without mutating this checkout's installed packages.
    const root = await mkdtemp(join(tmpdir(), 'dsh-reader-no-canvas-'))
    try {
      await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module' }))
      await cp(fileURLToPath(new URL('../lib', import.meta.url)), join(root, 'lib'), { recursive: true })
      for (const name of ['@deepseek-ai/dsh-fs', 'mammoth', 'word-extractor', 'read-excel-file', 'yauzl']) {
        const destination = join(root, 'node_modules', name)
        await mkdir(dirname(destination), { recursive: true })
        await symlink(await realpath(fileURLToPath(new URL(`../node_modules/${name}`, import.meta.url))), destination, 'junction')
      }
      const require = createRequire(import.meta.url)
      const pdfEntry = require.resolve('pdfjs-dist/legacy/build/pdf.mjs')
      const pdfRoot = dirname(dirname(dirname(pdfEntry)))
      const pdfDestination = join(root, 'node_modules/pdfjs-dist')
      await mkdir(pdfDestination, { recursive: true })
      await cp(join(pdfRoot, 'package.json'), join(pdfDestination, 'package.json'))
      await cp(join(pdfRoot, 'legacy/build'), join(pdfDestination, 'legacy/build'), { recursive: true })
      if (absent === 'native-binary') {
        const pdfRequire = createRequire(pdfEntry)
        await cp(dirname(pdfRequire.resolve('@napi-rs/canvas')), join(root, 'node_modules/@napi-rs/canvas'), { recursive: true })
      }
      const source = `
        import assert from 'node:assert/strict';
        import { createRequire } from 'node:module';
        const require = createRequire(${JSON.stringify(pathToFileURL(join(root, 'lib/parse/runner.js')).href)});
        const pdfRequire = createRequire(require.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
        assert.throws(() => pdfRequire('@napi-rs/canvas'));
        const { runParser } = await import(${JSON.stringify(pathToFileURL(join(root, 'lib/parse/runner.js')).href)});
        const { parseLimits } = await import(${JSON.stringify(pathToFileURL(join(root, 'lib/parse/limits.js')).href)});
        const result = await runParser({ bytes: new TextEncoder().encode('optional dependency absent'),
          format: 'text', options: { sheetRowLimit: 200 }, limits: parseLimits(),
          offset: 1, limit: 1, maxOutputChars: 2000 }, new AbortController().signal);
        assert.equal(result.lines[0]?.text, 'optional dependency absent');
        console.log('optional dependency absent');
      `
      const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], {
        timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true,
      })
      assert.equal(stdout.trim(), 'optional dependency absent')
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}
