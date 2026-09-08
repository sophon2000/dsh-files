export const DEFAULT_PARSE_LIMITS = {
    maxExpandedBytes: 64 * 1024 * 1024,
    maxArchiveEntries: 2048,
    maxCompressionRatio: 200,
    maxParsedChars: 2 * 1024 * 1024,
    maxPdfPages: 200,
    maxParseMs: 30_000,
    workerHeapMb: 128,
    maxConcurrentReads: 2
};
export function parseLimits(overrides = {}) {
    const result = { ...DEFAULT_PARSE_LIMITS, ...overrides };
    for (const [key, value] of Object.entries(result)) {
        if (!Number.isSafeInteger(value) || value < 1)
            throw new Error(`${key} must be a positive safe integer`);
    }
    // Bound deployment mistakes as well as individual inputs.
    if (result.maxParseMs > 120_000 || result.workerHeapMb > 256 || result.maxConcurrentReads > 4 ||
        result.maxExpandedBytes > 128 * 1024 * 1024 || result.maxArchiveEntries > 4096 ||
        result.maxParsedChars > 8 * 1024 * 1024 || result.maxPdfPages > 1000 || result.maxCompressionRatio > 1000) {
        throw new Error('parser configuration exceeds supported safety ceiling');
    }
    return result;
}
