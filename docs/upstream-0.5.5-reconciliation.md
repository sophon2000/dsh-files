# Original upstream 0.5.5 reconciliation

This local, unpublished integration has two real Git parents:

- Preserved Video Harness fork: `61eb268a3451d6c60889264ea3009123ccd3214d` (`0.5.3-vh.3`)
- Original upstream `taxueseek/dsh-files`: `10d6bf12221ef4d131cc5e66eb8553e84df2c3c9` (`0.5.5`), tree `a6d471b41302fef9da9290902fd9fafc7d1b8715`
- Common ancestor: `8f2d0bdf874b3e30ff19b40ab3f19a8a50e168a0` (`0.5.3`)

The upstream commit and tree were fetched from the original public Git repository, not reconstructed from a version label. The merge retains the existing bounded-reader policy. A future decision to restore upstream attachment or UI features would be a separate architectural change.

## Five incoming commits

- `b9084757ff8a48e50a9c921013e03d8036a2956e`: broadens the old `dsh-client-runtime` peer range. That peer stays absent because this fork has no client runtime dependency.
- `1e087309b65c7ff1fd9b3ed9097c4a63b4547bd4`: adds attachment-route error hints, client diagnostics and their tests. These modify only the previously excluded attachment surface, so those files stay deleted. Its explanation of native preview versus model-readable extraction is retained in both fork READMEs.
- `708147b9b24497f8cecd107440375ef023980b17`: rewrites and repairs the upstream READMEs. Fork-specific bilingual documentation is reconciled instead of restoring instructions for absent attachment features.
- `59b2880079e9ed7370bb1a46569faaf0270f8dca`: aligns upstream SDK dependencies to `0.2.0-rc.2` and changes the upstream version to `0.5.5`. This integration adopts `0.5.5-vh.1`, exact `0.2.0-rc.2.vh.1` fork peers/development packages and the existing immutable qualified dependency graph. It does not add React or UI packages. Upstream still declares client-runtime/conversation injection and React/client-runtime peers despite broader README claims; the fork keeps `inject: []` and excludes that dependency graph. Cordis `4.0.4` and Schemastery `3.18.4` remain the accepted immutable fork versions, rather than the older upstream declarations.
- `10d6bf12221ef4d131cc5e66eb8553e84df2c3c9`: removes an accidentally committed local backup and adds the `*.bak-*` ignore pattern. The final upstream-tree ignore rule is incorporated; the transient backup is not restored.

## All fourteen changed paths

| Upstream path | Merge decision |
| --- | --- |
| `.gitignore` | Incorporate `*.bak-*`; keep the fork's tracked workspace configuration |
| `CHANGELOG.md` | Retain incoming 0.5.4/0.5.5 history explicitly labeled upstream reference; add fork-specific 0.5.5-vh.1 scope |
| `README.i18n.yaml` | Regenerate both Git blob hashes after the bilingual reconciliation |
| `README.md` | Retain fork instructions; update upstream provenance and native-preview/text-extraction distinction |
| `README.zh.md` | Apply the matching Chinese changes |
| `lib/attachment-loop.js` | Keep deleted; no custom attachment routes or model tools |
| `lib/client.js` | Rebuild the retained no-op client, not the upstream attachment UI |
| `lib/client.js.map` | Rebuild the retained no-op client's matching source map |
| `package.json` | Adopt 0.5.5-vh.1; retain exact rc2 fork family and bounded-reader dependency surface |
| `pnpm-lock.yaml` | Retain the accepted immutable qualified dependency bytes; no old upstream SDK/UI graph |
| `src/attachment-loop.ts` | Keep deleted under the existing capability boundary |
| `src/client/dock.tsx` | Keep deleted under the existing capability boundary |
| `src/client/index.tsx` | Keep deleted; retain `src/client/read-only.ts` |
| `test/attachment-loop.test.ts` | Keep deleted alongside its absent feature; no new security experiments |

## Verification meaning

The upstream delta contains no changes to `src/tool.ts`, `src/detect.ts`, `src/parse.ts` or any existing `src/parse/` implementation. Parser library versions also do not change in this incoming delta; the existing exact parser pins are preserved (including the earlier intentional Mammoth `1.12.2` divergence). The bounded fork implementation and generated runtime files are therefore expected to remain byte-identical to the preserved fork parent. Local evidence records the actual comparison, source commit, dependency integrity, packed-file SHA-256 hashes and repeated-pack result.

Run the existing build/typecheck/unit checks and frozen install on Linux with Node.js `24.15.0` and pnpm `11.9.0`. The new artifact must be consumed in a fresh rc2 profile for integration qualification. Upstream's historical 100-test and desktop statements are not results for this fork; no native macOS/Windows testing or external publication is claimed.
