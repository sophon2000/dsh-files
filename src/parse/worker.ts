import { parentPort, workerData } from 'node:worker_threads'
import { parseDocument, type ParseOptions } from './index.ts'
import { checkArchive } from './archive.ts'
import { parseLimits, type ParseLimits } from './limits.ts'
import type { DocumentFormat } from '../detect.ts'
import { windowLines } from './text.ts'

export interface ParseRequest {
  bytes: Uint8Array
  format: DocumentFormat
  options: ParseOptions
  limits: ParseLimits
  offset: number
  limit: number
  maxOutputChars: number
}

try {
  const request = workerData as ParseRequest
  const limits = parseLimits(request.limits)
  if (request.format === 'xlsx' || request.format === 'docx') await checkArchive(request.bytes, limits)
  const text = await parseDocument(request.bytes, request.format, { ...request.options, limits })
  if (text.length > limits.maxParsedChars) throw new Error('document exceeds parsed text budget')
  parentPort!.postMessage({ ok: true, value: windowLines(text, request.offset, request.limit, request.maxOutputChars) })
} catch (error) {
  parentPort!.postMessage({ ok: false, error: error instanceof Error ? error.message : 'document parsing failed' })
}
