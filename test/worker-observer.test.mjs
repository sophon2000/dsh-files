import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { once } from 'node:events'
import { startWorkerObserver,observeCancellationSignal,assertInFlightCancellation } from '../qualification/worker-observer.mjs'
import { runParser } from '../lib/parse/runner.js'
import { parseLimits } from '../lib/parse/limits.js'

test('diagnostic observer records a real parser Worker lifetime without changing its result',async()=>{
  const root=await mkdtemp(join(tmpdir(),'dsh-reader-worker-observer-'))
  const stop=startWorkerObserver(root,fileURLToPath(new URL('../lib/parse/runner.js',import.meta.url)))
  try {
    await writeFile(join(root,'worker-arm.json'),JSON.stringify({id:'unit-observation'}))
    const unrelated=new Worker('void 0',{eval:true,execArgv:[],env:{}})
    await once(unrelated,'exit')
    await assert.rejects(readFile(join(root,'worker-lifetime.jsonl')),error=>error.code==='ENOENT','unrelated Worker must not supply parser evidence')
    const controller=new AbortController()
    observeCancellationSignal(root,'unit-observation',controller.signal)
    const result=await runParser({bytes:new TextEncoder().encode('OBSERVED_REAL_READ'),format:'text',options:{sheetRowLimit:200},limits:parseLimits(),offset:1,limit:1,maxOutputChars:2000},controller.signal)
    assert.equal(result.lines[0]?.text,'OBSERVED_REAL_READ')
    const events=(await readFile(join(root,'worker-lifetime.jsonl'),'utf8')).trim().split('\n').map(JSON.parse)
    assert.deepEqual(events.map(event=>event.type),['created','online','exit'])
    assert.ok(events.every(event=>event.id==='unit-observation'&&event.threadId===events[0].threadId))
    assert.ok(Number.isSafeInteger(events[0].threadId)&&events[0].threadId>0)
    assert.ok(Number.isInteger(events[2].code),'exit is observed before runParser settles')
    controller.abort()
    const late=(await readFile(join(root,'worker-lifetime.jsonl'),'utf8')).trim().split('\n').map(JSON.parse)
    assert.equal(late.at(-1).workerExited,true)
    assert.throws(()=>assertInFlightCancellation(late,'unit-observation'),/cancel must reach the Tool/,'a real Worker that exits before cancellation must never qualify')
  } finally {stop();await rm(root,{recursive:true,force:true})}
})
