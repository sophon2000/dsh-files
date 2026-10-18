import assert from 'node:assert/strict'
import { subscribe,unsubscribe } from 'node:diagnostics_channel'
import { appendFileSync,existsSync,readFileSync,realpathSync,statSync } from 'node:fs'
import { join } from 'node:path'

// Qualification-only observation via Node's public diagnostic channel. This
// neither replaces Worker nor changes its input, resources, signals or lifetime.
export function startWorkerObserver(root,runner) {
  const directory=realpathSync(root),source=realpathSync(runner).replaceAll('\\','/')
  const armed=join(directory,'worker-arm.json'),output=join(directory,'worker-lifetime.jsonl')
  const selected=new Set()
  const observe=({worker})=>{
    if(!existsSync(armed))return
    const stack=new Error().stack?.replaceAll('\\','/')??''
    if(!stack.includes(source))return
    assert.ok(statSync(armed).size<=1024,'bounded observer arm record required')
    const arm=JSON.parse(readFileSync(armed,'utf8'))
    assert.ok(typeof arm.id==='string'&&arm.id.length>0&&arm.id.length<=128,'invalid observer arm identity')
    if(selected.has(arm.id))return
    assert.ok(selected.size<2,'qualification permits at most two selected parser workers')
    selected.add(arm.id)
    const threadId=worker.threadId
    const record=(type,extra={})=>appendFileSync(output,JSON.stringify({id:arm.id,type,threadId,at:Date.now(),...extra})+'\n')
    record('created')
    worker.once('online',()=>record('online'))
    worker.once('exit',code=>record('exit',{code}))
  }
  subscribe('worker_threads',observe)
  return ()=>{unsubscribe('worker_threads',observe)}
}

// Observe the tool's real abort signal at the Host, closing the race between
// parent-side polling and receipt of the cancel RPC. This never aborts the tool.
export function observeCancellationSignal(root,id,signal) {
  assert.equal(signal.aborted,false,'qualification requires an initially live Tool signal')
  const output=join(realpathSync(root),'worker-lifetime.jsonl')
  signal.addEventListener('abort',()=>{
    const events=existsSync(output)?readFileSync(output,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter(row=>row.id===id):[]
    appendFileSync(output,JSON.stringify({id,type:'signal-abort',threadId:events[0]?.threadId??null,online:events.some(row=>row.type==='online'),workerExited:events.some(row=>row.type==='exit'),at:Date.now()})+'\n')
  },{once:true})
}

export function assertInFlightCancellation(events,id) {
  const lifetime=events.filter(row=>row.id===id)
  assert.deepEqual(lifetime.map(row=>row.type),['created','online','signal-abort','exit'],'cancel must reach the Tool while its actual Worker is online and has not exited')
  assert.ok(lifetime.every(row=>row.threadId===lifetime[0].threadId&&Number.isSafeInteger(row.threadId)&&row.threadId>0))
  assert.equal(lifetime[2].online,true)
  assert.equal(lifetime[2].workerExited,false)
  return lifetime
}

if(process.env.DSH_READER_OBSERVER_ROOT||process.env.DSH_READER_OBSERVER_RUNNER){
  assert.ok(process.env.DSH_READER_OBSERVER_ROOT&&process.env.DSH_READER_OBSERVER_RUNNER,'both observer paths required')
  startWorkerObserver(process.env.DSH_READER_OBSERVER_ROOT,process.env.DSH_READER_OBSERVER_RUNNER)
}
