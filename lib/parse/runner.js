import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { FsError } from '@deepseek-ai/dsh-fs';
// The pinned Skia addon can crash on Windows when its final environment is a
// terminating Worker. Keep one parent environment alive for the process lifetime.
// Load only the binding: no system-font scan or document parsing in the parent.
let windowsParserBinding;
function retainWindowsParserBinding() {
    if (process.platform !== 'win32' || windowsParserBinding !== undefined)
        return;
    windowsParserBinding = null;
    const require = createRequire(import.meta.url);
    const pdfRequire = createRequire(require.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
    let canvasEntry;
    try {
        canvasEntry = pdfRequire.resolve('@napi-rs/canvas');
    }
    catch {
        return;
    } // PDF.js tolerates this optional dependency being absent.
    const canvasRequire = createRequire(canvasEntry);
    if (!['x64', 'ia32', 'arm64'].includes(process.arch))
        return;
    const variables = process.config.variables;
    const abi = process.arch === 'x64' && (('shlib_suffix' in variables && variables.shlib_suffix === 'dll.a')
        || ('node_target_type' in variables && variables.node_target_type === 'shared_library')) ? 'gnu' : 'msvc';
    const target = `win32-${process.arch}-${abi}`;
    // Match the pinned loader's native candidates under the Worker's env: {}.
    // Calling js-binding.js here would honor unrelated host NAPI_RS_* overrides.
    const canvasDirectory = dirname(canvasEntry);
    for (const candidate of [join(canvasDirectory, `skia.${target}.node`), `@napi-rs/canvas-${target}`]) {
        try {
            windowsParserBinding = canvasRequire(candidate);
            return;
        }
        catch { /* Like PDF.js, keep non-canvas formats usable if the addon is unavailable. */ }
    }
}
// workerUrl is an internal test seam, never a Tool or Profile parameter.
export async function runParser(request, signal, workerUrl = new URL(import.meta.url.endsWith('.ts') ? './worker.ts' : './worker.js', import.meta.url)) {
    if (signal.aborted)
        throw new FsError('read_document aborted', 'FS_ABORTED');
    retainWindowsParserBinding();
    const worker = new Worker(workerUrl, {
        workerData: request,
        env: {}, // No provider credentials passed to parser dependencies.
        execArgv: [],
        stdout: true,
        stderr: true,
        resourceLimits: { maxOldGenerationSizeMb: request.limits.workerHeapMb, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 }
    });
    // Discard parser diagnostics rather than leaking document content or buffering indefinitely.
    worker.stdout.resume();
    worker.stderr.resume();
    let timer;
    let onAbort = () => { };
    try {
        return await new Promise((resolve, reject) => {
            onAbort = () => reject(new FsError('read_document aborted', 'FS_ABORTED'));
            signal.addEventListener('abort', onAbort, { once: true });
            if (signal.aborted)
                onAbort();
            timer = setTimeout(() => reject(new Error('document parser time budget exceeded')), request.limits.maxParseMs);
            worker.once('error', reject);
            worker.once('exit', (code) => reject(new Error(`document parser exited without result (${code})`)));
            worker.once('message', (message) => {
                if (!message || typeof message !== 'object' || !('ok' in message))
                    return reject(new Error('invalid parser response'));
                const result = message;
                if (result.ok === true && result.value && Number.isSafeInteger(result.value.totalLines) && result.value.totalLines >= 0 && Array.isArray(result.value.lines) &&
                    result.value.lines.length <= request.limit && result.value.lines.every(line => line !== null && typeof line === 'object' && Number.isSafeInteger(line.number) && line.number > 0 && line.number <= result.value.totalLines && typeof line.text === 'string') &&
                    JSON.stringify(result.value).length <= request.maxOutputChars * 2 + request.limit * 100 + 1024)
                    resolve(result.value);
                else
                    reject(new Error(typeof result.error === 'string' ? result.error : 'invalid parser response'));
            });
        });
    }
    finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        // Await exit on success, rejection, timeout and cancellation: no detached work.
        await worker.terminate();
    }
}
