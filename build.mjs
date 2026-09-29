// Build the client bundle in the dsh ModuleLoader handoff format:
//   window.__ModuleLoader__.load({ id: "<name>", factory: (require) => { ... return module.exports; } });
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

await build({
  entryPoints: ['src/client/read-only.ts'],
  bundle: true,
  minifySyntax: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2020'],
  outfile: 'lib/client.js',
  // CHANGELOG 0.5.1 起按 minified 体积口径对外；banner/footer 原样拼接，
  // ModuleLoader 包装不受压缩影响。
  minify: true,
  // External packages are resolved through the factory's `require` at runtime,
  // mirroring how the official client modules load third-party bundles.
  external: [],
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`
  },
  footer: {
    js: `return module.exports; } });`
  },
  sourcemap: true,
  logLevel: 'info'
})
