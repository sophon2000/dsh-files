# dsh-files fork policy

## Release identity

- Version: `0.5.3-vh.3` (local candidate, unpublished)
- Upstream base: `dsh-files` `0.5.3` at `8f2d0bd`
- Candidate host: `@deepseek-ai/*` `0.2.0-rc.2.vh.1`
- Distribution policy: versioned assets from `sophon2000/dsh-files` GitHub Releases only; no rc2 publication has been performed
- Fork base: `46feb1d41ab4b9f18288504dea6904968a8c4daa`
- Local candidate dependencies: clean DSH rc2 tarballs, served by an explicitly configured local registry; exact versions and artifact integrity are locked, with no assumed release URLs

## Retained from upstream 0.5.3

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

Use Node.js `24.15.0` and pnpm `11.9.0`. The rc2 fork packages are unpublished local candidates. Configure the `@deepseek-ai` registry explicitly to serve the verified candidate family before the frozen install; the public npm registry is not a source for these candidate versions. The lockfile integrity identifies the bytes tested. Do not substitute upstream rc2 or rc1 packages. The exact Cordis `4.0.4`, Cosmokit `1.8.5` and Schemastery `3.18.4` archives are reused byte-for-byte from the accepted Video Harness rc1 artifact set. This aligns the reader development lock with the consumer immutable vendor identities; it is not a claim that the earlier reader lock used those same repacked archives.

`node qualification/artifact.mjs` builds and packs twice, checks the package allowlist, and records source and per-file archive SHA-256 hashes in a local manifest. It does not publish or alter a DSH profile.

Local Linux build, typecheck, unit regression and artifact checks are separate from the full release gates below. Native macOS/Windows tests and production release qualification remain unclaimed.

## Qualification

Release gates:

1. frozen dependency install and lock review
2. `pnpm run check`
3. production-only audit review
4. two packs with matching SHA-256 in the same toolchain
5. tarball allowlist inspection: no attachment-loop/client UI modules
6. install into a fresh DSH `0.2.0-rc.2.vh.1` profile
7. real tool calls for text, PDF, DOC, DOCX, XLSX, paging, cancellation, invalid arguments and workspace cwd

Worker heap limits constrain V8 old space, not process RSS, native allocations or all ArrayBuffers. Office libraries still parse selected documents in memory. This is a bounded development-document reader, not an unrestricted hostile conversion service.

Reads inherit native DSH filesystem authorization. They do not prove Video Harness Asset authorization or create CreativeInput evidence. Formal business imports remain owned by Video Harness.
