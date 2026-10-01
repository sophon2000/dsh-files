# dsh-files · Video Harness fork

`dsh-files` adds one model-facing capability to DeepSeek Harness: bounded structured-text extraction for documents that the native text reader cannot parse.

This **unpublished local candidate `0.5.3-vh.3`** targets **DSH `0.2.0-rc.2.vh.1`**. It is built and tested against the verified local rc2 package family. No release URL is assigned to this candidate. Published builds use versioned assets from the [fork releases](https://github.com/sophon2000/dsh-files/releases); the unrelated npm package name is not a distribution channel for this build.

## Capability boundary

- Registers only `read_document`.
- Reads through DSH `ctx.fs`, so native filesystem resolution, authorization and observations remain authoritative.
- Supports text, PDF, Word 97–2003 (`.doc`), DOCX and XLSX.
- Keeps native DSH attachment upload, preview, download and file tabs as the only user-facing file UI.
- Does not register an attachment library, folder uploader, export route, `@` source, custom upload path or business-document binding.
- Ships a no-op client module solely for the DSH package handoff; it injects no client services and renders nothing.

The upstream 0.5.3 attachment-loop implementation remains available in Git history for comparison. It is intentionally absent from this release artifact because DSH 0.2 and Video Harness Catalog own those responsibilities.

## `read_document`

The tool sniffs content bytes before extension hints and exposes explicit paging:

- `file_path`: filesystem path understood by DSH
- `format`: `auto | text | pdf | doc | docx | xlsx`
- `offset` / `limit`: line window
- `list_sheets`: list XLSX sheets before reading cells
- `sheet`: one-based XLSX sheet selector

Safety and resource behavior:

- one fresh Worker per parse, awaited termination on success, error, timeout or abort
- per-tool concurrency rejection instead of an unbounded queue
- ZIP entry, expansion, compression-ratio and inflated-byte checks for DOCX/XLSX
- file, parsed-character, PDF-page, output-window, timeout and Worker-heap limits
- source bytes are read-only and never become a project asset by this plugin

Legacy `.doc` uses macOS `textutil` when available and falls back to `word-extractor`. Old `.xls` and `.ppt` share the OLE container signature but are rejected with an actionable error.

## Default configuration

```yaml
maxFileBytes: 25165824
readLimit: 2000
sheetRowLimit: 200
maxSheets: 5
maxOutputChars: 24000
readTimeoutMs: 120000
parser:
  maxExpandedBytes: 67108864
  maxArchiveEntries: 2048
  maxCompressionRatio: 200
  maxParsedChars: 2097152
  maxPdfPages: 200
  maxParseMs: 30000
  workerHeapMb: 128
  maxConcurrentReads: 2
```

## Development checks

Use Node.js `24.15.0` and pnpm `11.9.0`. Configure the candidate registry as described in [FORK.md](FORK.md) before installing these unpublished dependencies.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run check
npm pack --ignore-scripts
```

The release must additionally be installed in a fresh DSH profile and exercised through a real `read_document` tool call. See [FORK.md](FORK.md) for the exact fork baseline, artifact rules and qualification limits.

## License

MIT. Parser dependencies retain their own licenses: PDF.js (Apache-2.0), Mammoth (BSD-2-Clause), read-excel-file (MIT), word-extractor (MIT) and yauzl (MIT).
