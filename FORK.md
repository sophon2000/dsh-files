# dsh-files fork policy

## Release identity

- Version: `0.5.5-vh.5.local.20261019.3` (local candidate, unpublished)
- Original upstream: [`taxueseek/dsh-files`](https://github.com/taxueseek/dsh-files), `0.5.5` at `10d6bf12221ef4d131cc5e66eb8553e84df2c3c9`
- Upstream tree: `a6d471b41302fef9da9290902fd9fafc7d1b8715`
- Candidate host: DSH `0.2.1-rc.2.vh.1.local.20261019.3`, Cordis `4.0.5`, Schemastery `3.18.5`
- Distribution policy: versioned assets from `sophon2000/dsh-files` GitHub Releases only; this candidate has not been published
- Preserved fork parent: `61eb268a3451d6c60889264ea3009123ccd3214d` (`0.5.3-vh.3`)
- Integration: two-parent merge of that fork parent and the exact original-upstream commit above
- Shared upstream ancestor: `8f2d0bdf874b3e30ff19b40ab3f19a8a50e168a0` (`0.5.3`)
- Current candidate parent: `ac07b7dbcabab00f213e5baf8b6e21aef439a5b7` (local.2); its immutable tarball and qualification evidence are preserved. The earlier vh.4 archive remains bound to `2be7701e394eaeda95ee8f8c1f24c001bdeb2de3`. No Reader upstream refresh.
- Local candidate dependencies: clean DSH rc.2-based candidate tarballs, served by an explicitly configured local registry; exact versions and artifact integrity must be locked before qualification, with no assumed release URLs

## Upstream 0.5.5 reconciliation

The five original-upstream commits after `0.5.3` were fetched and merged with actual ancestry. SDK alignment is adapted to the exact fork host `0.2.0-rc.2.vh.1`, retaining the existing immutable vendor archives. The local backup ignore rule is incorporated, and the bilingual docs distinguish document text extraction from native preview. Upstream attachment-route hints, dock and `@` diagnostics remain excluded under the existing read-only boundary; their source and generated UI are not restored.

No `read_document`, detection or parser implementation changed upstream across those five commits, so the bounded fork implementations are retained byte-for-byte. See [the reconciliation record](docs/upstream-0.5.5-reconciliation.md) for commit and file decisions. Upstream desktop claims and its 100-test result are historical upstream evidence, not tests of this fork.

## DSH rc.2 candidate compatibility

`0.5.5-vh.5.local.20261019.3` adapts exact Host/vendor pins for the rc.2-based Video candidate. `ensureForExecution(exec)` remains mandatory: the Host authorizer and Reader must resolve the same validated directory for one execution, including cancellation and directory-change races. Do not replace it with a session header or a fresh mutable cwd read. Parser dependencies, read budgets, Worker termination and the no-op client remain unchanged.

This is a new local candidate, not a repack under the previous version or a published release. Previous build/test/audit/Profile results are historical observations only. Generate the new lock from the actual supplied candidate registry and complete the original checks before claiming compatibility. No Windows or paid-provider run is part of this Linux preparation.

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

Use Node.js `24.15.0` and pnpm `11.9.0`. The rc.2-based fork packages are unpublished local candidates. Configure the `@deepseek-ai` registry explicitly to serve the verified candidate family before the frozen install; the public npm registry is not a source for these candidate versions. The lockfile integrity identifies the bytes tested. Do not substitute official rc.2 or older fork packages. Cordis `4.0.5` and Schemastery `3.18.5`, plus transitive vendor packages, must use the same immutable archives as the new consumer artifact manifest.

`node qualification/artifact.mjs` builds and packs twice, checks the package allowlist, and records source and per-file archive SHA-256 hashes in a local manifest. On Windows it launches bundled npm and exact-version pnpm through Node's JavaScript entry points, without a shell or `.cmd` shim. It does not publish or alter a DSH profile.

Local build, typecheck, unit regression and artifact checks are separate from the full release gates below. Native desktop packaging and production release qualification remain separate requirements.

## Qualification

Release gates:

1. frozen dependency install and lock review
2. `pnpm run check`
3. production-only audit review
4. two packs with matching SHA-256 in the same toolchain
5. tarball allowlist inspection: no attachment-loop/client UI modules
6. install into a fresh DSH `0.2.1-rc.2.vh.1.local.20261019.3` profile
7. real tool calls for text, PDF, DOC, DOCX, XLSX, paging, cancellation, invalid arguments and current working-directory changes

The current production audit reports one moderate advisory, [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), in the retained `mammoth > argparse > sprintf-js@1.0.3` chain. The [official CVE record](https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/2026/97xxx/CVE-2026-97058.json) marks its `CVE-2026-97058` identity REJECTED by the CNA on 2026-10-12; the GitHub/npm audit data had not synchronized at the 2026-10-18 observation. npm still publishes latest `1.1.3`, with no `1.1.4` release, so the audit's patched range is not an available upgrade.

On 2026-10-18 the human maintainer explicitly authorized disposition of this one officially rejected item, preserving fixed dependencies and the original nonzero audit result. `qualification/audit-disposition.mjs` validates the exact advisory/module/version/dependency chain against freshly retrieved GitHub identity and CVE CNA rejection records. It saves the raw report, authority bodies/hashes/timestamp and separate review result. Missing or changed authority, changed findings, contradictory counts and every other advisory still block qualification. No npm audit ignore or dependency override is configured. Parser inputs also do not reach this unused CLI chain in the scoped compiled-DOCX observation; that observation alone does not grant an audit exception. Reassess if authority records or the call graph changes.

Worker heap limits constrain V8 old space, not process RSS, native allocations or all ArrayBuffers. Office libraries still parse selected documents in memory. This is a bounded development-document reader, not an unrestricted hostile conversion service.

Reads inherit native DSH filesystem authorization. They do not prove Video Harness Asset authorization or create CreativeInput evidence. Formal business imports remain owned by Video Harness.
