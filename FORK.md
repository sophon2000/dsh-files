# dsh-files: read-only qualification candidate

2026-09-08 · `0.5.1-vh.2` · upstream `a814c7b89b0800870d3404d7b51362e9914a8092`.
Development branch: `vh/reader-qualification`. Qualification prerelease line; not an installed main Profile dependency.
Distribution, when published, is exclusively the versioned assets at `https://github.com/sophon2000/dsh-files/releases`;
never infer publication from this source file or install the unrelated npm name. Check the release manifest and digest.

## Purpose and scope

Keep the upstream parser libraries and the DSH FS/Tool/native attachment pipeline.
Do not introduce a document editor, custom upload route, business source binding, or a second sidebar.
Upstream reference checkout stays read-only; this is the separate maintained fork.

- Default Client is a no-op (no buttons, styles or drop listeners).
- `DSH_FILES_FOLDER_UPLOAD=1 pnpm run build` produces an **experimental opt-in build** using the upstream folder UI.
  Host CSS hashes have been removed. This is a build-time capability, **not a runtime settings toggle**.
  Folder opt-in has not passed the full UI/data-loss/large-directory matrix; it must not be shipped under the qualified default artifact digest.
- Each real Tool parse runs in a fresh Worker; abort/timeout/success/error all await worker termination.
  Parser code receives bytes, not a filesystem path or provider credentials. A Worker is resource separation, not an OS security sandbox.
- A per-tool-instance read gate rejects excess concurrency before FS I/O instead of growing an unbounded queue.
- DOCX/XLSX ZIPs are streamed through yauzl before parsing; entry count, metadata expansion ratio, declared total and actual inflated bytes are checked.
  Duplicate/encrypted entries and size inconsistencies reject. Nothing is extracted onto disk.
- Page/parsed-text budgets reject explicitly rather than silently accepting incomplete content. Output pagination stays upstream-compatible.

## Defaults and limits

Existing byte cap: 24 MiB. New `config.parser` defaults:

| Field | Default |
|---|---:|
| maxExpandedBytes | 64 MiB |
| maxArchiveEntries | 2048 |
| maxCompressionRatio | 200 |
| maxParsedChars | 2 Mi characters |
| maxPdfPages | 200 |
| maxParseMs | 30000 |
| workerHeapMb | 128 |
| maxConcurrentReads | 2 |

Host config validates positive safe integers and upper safety ceilings. Worker heap cap covers V8 old space,
**not process RSS, native allocations or ArrayBuffers**. Whole-process memory exhaustion is not ruled out.
Office libraries still parse whole selected sheets/documents after preflight; row pagination is not streaming cell extraction.
Use for bounded development documents, not an unrestricted hostile-document conversion service.
Stronger isolation/whole-process quotas would require a separately qualified subprocess/OS worker policy.

Reads follow native DSH tool FS authorization, which can allow out-of-workspace reads; this is not Video Harness project-scoped Asset authorization.
Source files remain unchanged. TSV line positions are not A1 business anchors. Python Workbook Snapshot remains authoritative for formal imports.

## Dependency qualification

Direct parser versions: mammoth 1.12.2, read-excel-file 5.8.8, pdfjs-dist 4.10.38, yauzl 3.4.0.
The original development lock resolved argparse 1.0.3/lodash 3.2.0 and xmldom 0.8.14. Audit found 6 advisories.
The refreshed lock resolves argparse 1.0.10 (no lodash dependency) and xmldom 0.8.15; do not suppress these advisories.
An artifact's dependencies are resolved again by the consumer: preserve and audit the **consumer lockfile** too; the source lock alone is not proof.

Local unit/build dependency baseline remains DSH rc.8; real packaged-Profile testing uses installed DSH `0.1.3-alpha.2.vh.1`.
Peers name these two versions explicitly, not arbitrary future alpha versions. rc.8 has not received the real-browser matrix in this fork.
Profile `autoInstallPeers: false` uses Host-supplied services; a standalone peer scan can report missing peers even when the real Host load succeeds.

## Repeatable checks

Local verification environment: Node 24.15.0, pnpm 11.1.3; the fixed Host uses its own pnpm 11.7.0.
No global runtime/config changes or bare pip installs are required.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run check
pnpm audit --prod --json
npm pack --ignore-scripts --pack-destination /tmp
node qualification/dsh-profile.mjs /absolute/path/to/video-harness/dsh-plugins /tmp/dsh-files-0.5.1-vh.2.tgz
```

The integration harness is explicitly a development dependency on Video Harness test helpers, not a runtime dependency.
It creates a separate temporary DSH Profile and synthetic fixtures, runs real native upload and Tool calls with deterministic LLM replay,
checks 18 positive/negative cases and foreign receipt rejection, then restarts DSH and compares durable results. It never needs a paid model or real documents.
It is **fresh Profile installation against an existing fixed Host**, not a clean-machine/full-DSH install or a Windows/WSL qualification.
The emitted evidence directory holds the actual artifact digest, consumer audit, history and summary.

For repeatable local packaging run `node qualification/artifact.mjs`. It rebuilds and packs twice into a new temporary
directory, requires byte-identical tarballs in the current fixed environment, checks the package file allowlist and
required runtime/license entries, and emits a manifest with per-file sizes, artifact/source-lock digests and a source
snapshot. Dirty work has `releaseCommit: null`: the base HEAD is not falsely recorded as a release commit.
Pass the printed artifact path to `dsh-profile.mjs`; the harness also records consumer license metadata separately.
Reproducibility here is two builds on this machine, not an independent-machine/toolchain reproduction.

Candidate vh.2 rejects malformed optional argument types instead of silently defaulting to another sheet/window.
Same-name Workspace regression uses real files and Workers with an FS adapter: it proves per-call cwd propagation,
not complete native multi-Workspace UI/authorization qualification. DSH integration remains separately required.

Consumer license review must include transitive and optional dependencies. The current graph declares MIT,
BSD-2-Clause/BSD-3-Clause, ISC, Apache-2.0, `MIT OR GPL-3.0-or-later` (JSZip; choose MIT) and `MIT AND Zlib` (pako).
The generic `BSD` declaration of duck 0.1.12 was checked against its shipped two-condition LICENSE.
Preserve actual license/notice files when distributing dependencies; metadata-only inventory is not a substitute,
and embedded assets/native optional libraries need their own notice review before a redistributed offline bundle.

For a five-minute, owned-process browser inspection using that evidence:

```sh
node qualification/serve.mjs /absolute/path/to/video-harness/dsh-plugins /absolute/evidence/directory
```

Use the printed authenticated URL locally; do not publish tokens. SIGINT/SIGTERM or expiry shuts down the child.
Check: native attachment visible, extracted sheet content in generic Tool IN/OUT, no folder button, refresh/history restored.
This is text extraction, **not an Excel grid viewer**. Native image/media regression and multi-workspace UI matrix are separate, not implied by these 18 cases.

## Release boundary

No upstream PR, commit/push, npm publication or main Profile switch is implied by these checks.
Do not install the unrelated npm package named `dsh-files`; this fork is currently an explicit local tarball candidate.
Before release: review source/generated output, record exact source commit and tarball/consumer-lock digests, choose a controlled distribution identity,
run the target environment matrix, then update the formal recipe. Development local paths are never formal runtime dependencies.

References: [Node Worker resource limits/termination](https://nodejs.org/api/worker_threads.html),
[yauzl streamed entry validation](https://github.com/thejoshwolfe/yauzl),
[lodash advisory](https://github.com/advisories/GHSA-jf85-cpcp-j695),
[xmldom advisory](https://github.com/advisories/GHSA-6gmq-8vp8-gcm6).
New ZIP dependency yauzl is MIT; existing parser licenses (mammoth BSD-2-Clause, PDF.js Apache-2.0, read-excel-file MIT) remain applicable.
