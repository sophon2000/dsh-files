import { Worker } from 'node:worker_threads'
import type { ParseRequest } from './worker.ts'
import { FsError } from '@deepseek-ai/dsh-fs'
import type { windowLines } from './text.ts'

export type ParseWindow = ReturnType<typeof windowLines>

// workerUrl is an internal test seam, never a Tool or Profile parameter.
export async function runParser(request: ParseRequest, signal: AbortSignal,
  workerUrl = new URL(import.meta.url.endsWith('.ts') ? './worker.ts' : './worker.js', import.meta.url)
): Promise<ParseWindow> {
  if (signal.aborted) throw new FsError('read_document aborted', 'FS_ABORTED')
  const worker = new Worker(workerUrl, {
    workerData: request,
    env: {}, // No provider credentials passed to parser dependencies.
    execArgv: [],
    stdout: true,
    stderr: true,
    resourceLimits: { maxOldGenerationSizeMb: request.limits.workerHeapMb, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 }
  })
  // Discard parser diagnostics rather than leaking document content or buffering indefinitely.
  worker.stdout.resume()
  worker.stderr.resume()
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: () => void = () => {}
  try {
    return await new Promise<ParseWindow>((resolve, reject) => {
      onAbort = () => reject(new FsError('read_document aborted', 'FS_ABORTED'))
      signal.addEventListener('abort', onAbort, { once: true })
      if (signal.aborted) onAbort()
      timer = setTimeout(() => reject(new Error('document parser time budget exceeded')), request.limits.maxParseMs)
      worker.once('error', reject)
      worker.once('exit', (code) => reject(new Error(`document parser exited without result (${code})`)))
      worker.once('message', (message: unknown) => {
        if (!message || typeof message !== 'object' || !('ok' in message)) return reject(new Error('invalid parser response'))
        const result = message as { ok: boolean; value?: ParseWindow; error?: unknown }
        if (result.ok === true && result.value && Number.isSafeInteger(result.value.totalLines) && result.value.totalLines >= 0 && Array.isArray(result.value.lines) &&
            result.value.lines.length <= request.limit && result.value.lines.every(line => line !== null && typeof line === 'object' && Number.isSafeInteger(line.number) && line.number > 0 && line.number <= result.value!.totalLines && typeof line.text === 'string') &&
            JSON.stringify(result.value).length <= request.maxOutputChars * 2 + request.limit * 100 + 1024) resolve(result.value)
        else reject(new Error(typeof result.error === 'string' ? result.error : 'invalid parser response'))
      })
    })
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
    // Await exit on success, rejection, timeout and cancellation: no detached work.
    await worker.terminate()
  }
}
