# dsh-files fork policy

## Release identity

- Version: `0.5.5-vh.17.local.20261031.1` (development candidate; not a production qualification)
- Original upstream: [`taxueseek/dsh-files`](https://github.com/taxueseek/dsh-files), `0.5.5` at `10d6bf12221ef4d131cc5e66eb8553e84df2c3c9`
- Upstream tree: `a6d471b41302fef9da9290902fd9fafc7d1b8715`
- Candidate host: DSH `0.2.2-alpha.2.vh.2.local.20261031.1`, Cordis `4.0.6-alpha.1`, Schemastery `3.18.6-alpha.1`
- Historical vh.11 qualified local tarball: built from `0f93e311bfc679bee3fbc8a1a31e842a35d2b7b0`, SHA-256 `0690f6fcf22577aece76b1c68de18dcc6c76b7f8c6d2c642c6f85b7cf258312c`. Those sealed bytes are preserved; they do not qualify the new vh.14 candidate.
- Distribution policy: versioned assets from `sophon2000/dsh-files` GitHub Releases and the exact Video candidate kit; no npm publication
- Preserved fork parent: `61eb268a3451d6c60889264ea3009123ccd3214d` (`0.5.3-vh.3`)
- Integration: two-parent merge of that fork parent and the exact original-upstream commit above
- Shared upstream ancestor: `8f2d0bdf874b3e30ff19b40ab3f19a8a50e168a0` (`0.5.3`)
- Previous candidate parent: `a8cfa6f52022e3f7f0771bfb79d16902eb343db8` (`0.5.5-vh.8.local.20261022.1`); its immutable tarball and qualification evidence are preserved. The earlier vh.4 archive remains bound to `2be7701e394eaeda95ee8f8c1f24c001bdeb2de3`. No Reader upstream refresh.
- Local candidate dependencies: clean DSH master-based candidate tarballs, served by an explicitly configured local registry; exact versions and artifact integrity must be locked before qualification, with no assumed release URLs

## Upstream 0.5.5 reconciliation

The five original-upstream commits after `0.5.3` were fetched and merged with actual ancestry. SDK alignment is adapted to the exact fork host `0.2.0-rc.2.vh.1`, retaining the existing immutable vendor archives. The local backup ignore rule is incorporated, and the bilingual docs distinguish document text extraction from native preview. Upstream attachment-route hints, dock and `@` diagnostics remain excluded under the existing read-only boundary; their source and generated UI are not restored.

No `read_document`, detection or parser implementation changed upstream across those five commits, so the bounded fork implementations are retained byte-for-byte. See [the reconciliation record](docs/upstream-0.5.5-reconciliation.md) for commit and file decisions. Upstream desktop claims and its 100-test result are historical upstream evidence, not tests of this fork.

## DSH master vh.2 candidate compatibility

`0.5.5-vh.17.local.20261031.1` advances the exact Host pins from Reader source
`3c600e16d5c23543c3e0ce67e81944118195d496` to DSH
`0.2.2-alpha.2.vh.2.local.20261031.1`, source
`17eeb2094fea6e08067fdfd3ab34c3b44c4fdead` (tree
`59d7fccf4fdfabdbfcb9e0a8411ecc882f3bcded`). That Host corrects native file
tool execution-directory binding. Reader continues to pass the original execution
to `ensureForExecution(exec)`; parser code, worker lifetime, third-party pins and
the native DSH ownership of attachment UI remain unchanged. This is a new
immutable candidate requiring its own dependency lock, build, tests and archive
receipts. The earlier vh.16 archive and its evidence are preserved.

The lock resolves all 27 Host/vendor packages against manifest SHA-256
`a67b211db222696ec2811a024b8c0abb88984e5c9eb327477ed29e6a93ae6c77`.
Their versions and integrity match that H source manifest. All 94 public package
identities and integrity values are unchanged. Release-age exceptions contain
only its 387 exact package/version pairs; strict checks remain enabled.
The native Mac frozen install, build, typecheck and original source suite passed
with 79 tests and four Windows-only skips. The production dependency audit found
zero vulnerabilities. These source observations do not qualify a platform runtime
or consumer Profile; archive and actual installed-Host checks need their own receipts.

## Historical DSH master vh.1 compatibility

`0.5.5-vh.16.local.20261031.1` binds the existing Reader implementation to DSH `0.2.2-alpha.2.vh.1.local.20261031.1`, based on official master `ce7073d51254c26cd63b22a60835b8f948deb447`. Cordis and Schemastery follow that host's exact vendor versions. The prior Reader source is `01cab4dc8747e2a10116b67d5b4bdfe26685db87`; parser code, execution-directory binding, native worker lifetime and third-party parser dependencies are unchanged. The final DSH fork source and artifact hashes must come from the supplied manifest, not the official base alone. No older build, audit or Profile qualification is inherited.

The dependency lock was regenerated from the verified artifact manifest with SHA-256 `74194986c3bb60fa62e7819772512c9cfd62203da9f224b46fb9e0b5e64b7c58`, whose DSH source is `3400c4a11043fbd0ab486561edc23d6309f41463` (tree `6295973ce333b70adf3c833c99131bb04e16fd2d`). All 27 locked Host/vendor packages match that manifest's exact version and integrity. The 387 release-age exceptions enumerate only its exact package/version pairs; strict age checking remains enabled for other inputs. All non-DSH dependency identities and integrity hashes are unchanged.

The native Mac source check on 2026-10-31 completed a fresh frozen install with lifecycle scripts ignored, build, typecheck and 79 passing tests; four Windows-only tests were skipped. The production dependency audit returned zero findings. Reproducible archives and fresh Profile qualification require their own receipts bound to the final clean source; no earlier qualification is inherited.

## DSH rc.2 candidate compatibility

`0.5.5-vh.15.local.20261026.1` follows the integrated Web branding/account changes, based on Reader `4fb47a4844701fd92dc8fad5de5a8d1bc81ce9d1`. All DSH dependencies target `0.2.1-rc.2.vh.11.local.20261026.1`, built from clean SDK source `8dd1720169209a9a6df10e92f4e5400e0d0f70c9`. Parser/runtime behavior and third-party pins remain unchanged. Mac checks and reproducible packing are recorded separately from native Linux/Windows qualification. No earlier platform result is inherited.

The following vh.11/vh.10/vh.9 paragraphs are historical, not evidence for vh.12.

`0.5.5-vh.11.local.20261023.1` is the independently produced Linux successor, with exact DSH pins to `0.2.1-rc.2.vh.6.local.20261023.2`. Its source baseline is `95faa135b00fe565323d985ad08cd65c9794506d`; the matching DSH source is `74a47fb27e48bfd43c2ae79772495b5cf47a9db8` (tree `48967b0e47332fe4ba4d2d3851cff76a136a21af`). It requires fresh native Linux build, checks, reproducible packs and installed Profile qualification. Parser code and third-party versions are unchanged. The unavailable Windows vh.10 archive is not an input, and its version or results are not reused for this new artifact.

The vh.10 and vh.9 paragraphs below are historical candidate records, not qualification of vh.11.

`0.5.5-vh.10.local.20261023.1` advances only the exact DSH pins to `0.2.1-rc.2.vh.6.local.20261023.1` for the native Windows development SDK. Its direct parent is `798ddb49abd3ba8826b1787a167aba6b7d98f252` (vh.9). The DSH source is `87cc76e8fd584e6501e9c940cfd3ecff58da363b` (tree `fa3656e0d51b186de3d599c54efc2e8c90f15af5`). Runtime extraction behavior, parser dependencies and the Windows binding-lifetime fix are unchanged. Earlier vh.9 evidence remains historical; fresh checks and reproducible packs must bind this candidate's own clean commit.

`0.5.5-vh.9.local.20261023.1` adapts exact Host/vendor pins for the rc.2-based Video candidate. `ensureForExecution(exec)` remains mandatory: the Host authorizer and Reader must resolve the same validated directory for one execution, including cancellation and directory-change races. Do not replace it with a session header or a fresh mutable cwd read. Parser dependencies, read budgets, Worker termination and the no-op client remain unchanged.

This is a new local candidate, not a repack under the previous version or a published release. Previous build/test/audit/Profile results are historical observations only. Generate the new lock from the actual supplied candidate registry and complete the original checks before claiming compatibility. This Linux/WSL candidate targets clean DSH source `e28deaa4d332f901c4f1aaf66a91f22a6956e667` (tree `8df3164dc74f0908ad1879c90d748bd7837991ab`) and requires its completed fresh artifact manifest; the failed `.local.20261023.1` SDK export is not an input. Earlier archives are not relabeled; this candidate needs new build, tests and reproducible pack results bound to its own clean source commit. No paid-provider run is part of this preparation.

## Historical DSH alpha2 compatibility

`0.5.5-vh.4` retains the exact vh.3 Host peers, third-party dependency lock and runtime parser implementation. It adds native Profile qualification wiring and the explicitly authorized official-withdrawal audit review below, with a new artifact identity for the updated provenance documentation. Earlier vh.3 tarball/manifest bytes remain preserved. This successor still needs its own reproducible pack and fresh-profile evidence.

`0.5.5-vh.3` updates the exact runtime peers and development dependencies to DSH `0.2.1-alpha.2.vh.3`, whose Desktop supervisor supports bounded product-service readiness configuration for Windows cold startup. Format dispatch, extraction limits, third-party dependency pins and the read-only client remain unchanged; the Windows native binding lifetime adaptation is described below. This candidate requires its own frozen install, native build/tests, reproducible packs and fresh-profile tool qualification; earlier vh.2 observations do not qualify vh.3.

`0.5.5-vh.2` keeps the Reader upstream baseline and parser dependencies unchanged. It pins the new DSH candidate family and vendor versions, removes the retired `dsh-invariants` development package, and declares the `workingDirectory` service explicitly. `read_document` passes the exact execution object to `workingDirectory.ensureForExecution()`, sharing the first validated directory with the Host authorization check. A directory change after authorization affects the next execution, preserving the cancellation signal and the current call’s target. It no longer uses the immutable original `Session.header.cwd`; non-Agent calls retain filesystem-provider defaults. Directory validation failures propagate before document access and release the read budget.

## Windows native binding lifetime

The pinned PDF.js dependency loads `@napi-rs/canvas` `0.1.100`. On Windows, repeated Worker-only loads of that native binding reproduced a host access violation, independently of Reader, DSH, document parsing and Node's test runner. Holding its raw `js-binding.js` exports in the parent before the first Worker prevented the minimal reproduction. The Reader now resolves that exact transitive canvas installation through PDF.js and retains its native binding in the parent for the process lifetime on Windows. It follows the pinned loader's local-binary/platform-package order directly, matching the Worker's empty environment without consulting or changing host `NAPI_RS_*` overrides. Canvas and its native binary remain optional, matching PDF.js behavior when unavailable. This loads no document and performs no parent system-font scan. Other platforms keep the existing path; Node and all dependency versions remain fixed.

Every parse still has its own Worker, original heap/time/concurrency limits and awaited termination on success, failure or cancellation. The retained binding is process infrastructure, not a document or parser-result cache. A Windows regression executes thirty fresh reads through the actual compiled parser in a separate process and requires correct content plus normal process exit; it failed with `0xC0000005` before the fix. Additional subprocess checks exercise host overrides and real isolated PDF.js installations missing optional canvas or its native binary, without changing installed dependencies. This bounded lifetime adaptation does not make native addons a security boundary or certify other addon/runtime versions.

## Retained document extraction

- Word 97–2003 `.doc` content detection and extraction
- UTF-16 sniffing fixes and explicit DOC/PDF/DOCX/XLSX/text format contract
- parser fixes and upstream document fixtures

## Fork hardening retained

- fresh Worker per parse with termination awaited on every exit path
- bounded concurrent reads before filesystem I/O
- streamed ZIP preflight for DOCX/XLSX
- entry-count, expanded-byte, compression-ratio and parsed-output limits
- strict optional-argument validation and call-specific workspace cwd propagation
- no parser cache or writable document surface

## Intentionally excluded

The upstream attachment list/export tools, attachment HTTP routes, folder upload, attachment dock and `@` source are removed from source and generated artifacts. DSH 0.2 owns the generic file experience; Video Harness Catalog owns project media and business roles. Reintroducing either surface requires a new architecture decision and qualification, not an environment flag.

The shipped client is a no-op with `inject: []`. It exists only because the DSH package contract accepts a client handoff; it adds no UI, CSS, browser listeners or runtime dependency.

## Local candidate workflow

Use Node.js `24.15.0` and pnpm `11.9.0`. The master-based fork packages are unpublished local candidates. Configure the `@deepseek-ai` registry explicitly to serve the verified candidate family before the frozen install; the public npm registry is not a source for these candidate versions. The lockfile integrity identifies the bytes tested. Do not substitute official rc.2 or older fork packages. Cordis `4.0.6-alpha.1` and Schemastery `3.18.6-alpha.1`, plus transitive vendor packages, must use the same immutable archives as the new consumer artifact manifest.

`node qualification/artifact.mjs` builds and packs twice, checks the package allowlist, and records source and per-file archive SHA-256 hashes in a local manifest. On Windows it launches bundled npm and exact-version pnpm through Node's JavaScript entry points, without a shell or `.cmd` shim. It does not publish or alter a DSH profile.

Local build, typecheck, unit regression and artifact checks are separate from the full release gates below. Native desktop packaging and production release qualification remain separate requirements.

## Qualification

Release gates:

1. frozen dependency install and lock review
2. `pnpm run check`
3. production-only audit review
4. two packs with matching SHA-256 in the same toolchain
5. tarball allowlist inspection: no attachment-loop/client UI modules
6. install into a fresh DSH `0.2.2-alpha.2.vh.1.local.20261031.1` profile
7. real tool calls for text, PDF, DOC, DOCX, XLSX, paging, cancellation, invalid arguments and current working-directory changes

The historical 2026-10-18 production audit reported one moderate advisory, [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), in the retained `mammoth > argparse > sprintf-js@1.0.3` chain. The [official CVE record](https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/2026/97xxx/CVE-2026-97058.json) marks its `CVE-2026-97058` identity REJECTED by the CNA on 2026-10-12; the GitHub/npm audit data had not synchronized at the 2026-10-18 observation. npm still publishes latest `1.1.3`, with no `1.1.4` release, so the audit's patched range is not an available upgrade.

On 2026-10-18 the human maintainer explicitly authorized disposition of this one officially rejected item, preserving fixed dependencies and the original nonzero audit result. `qualification/audit-disposition.mjs` validates the exact advisory/module/version/dependency chain against freshly retrieved GitHub identity and CVE CNA rejection records. It saves the raw report, authority bodies/hashes/timestamp and separate review result. Missing or changed authority, changed findings, contradictory counts and every other advisory still block qualification. No npm audit ignore or dependency override is configured. Parser inputs also do not reach this unused CLI chain in the scoped compiled-DOCX observation; that observation alone does not grant an audit exception. Reassess if authority records or the call graph changes.

Worker heap limits constrain V8 old space, not process RSS, native allocations or all ArrayBuffers. Office libraries still parse selected documents in memory. This is a bounded development-document reader, not an unrestricted hostile conversion service.

Reads inherit native DSH filesystem authorization. They do not prove Video Harness Asset authorization or create CreativeInput evidence. Formal business imports remain owned by Video Harness.
