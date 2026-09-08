import { parentPort, workerData } from 'node:worker_threads';
import { parseDocument } from "./index.js";
import { checkArchive } from "./archive.js";
import { parseLimits } from "./limits.js";
import { windowLines } from "./text.js";
try {
    const request = workerData;
    const limits = parseLimits(request.limits);
    if (request.format === 'xlsx' || request.format === 'docx')
        await checkArchive(request.bytes, limits);
    const text = await parseDocument(request.bytes, request.format, { ...request.options, limits });
    if (text.length > limits.maxParsedChars)
        throw new Error('document exceeds parsed text budget');
    parentPort.postMessage({ ok: true, value: windowLines(text, request.offset, request.limit, request.maxOutputChars) });
}
catch (error) {
    parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : 'document parsing failed' });
}
