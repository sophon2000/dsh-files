import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export const withdrawnGhsa='GHSA-hp3w-g68c-fv3c'
export const withdrawnCve='CVE-2026-97058'
const levels=['info','low','moderate','high','critical']
const cna='83251b91-4cc7-4094-a5c7-464a1b83ea10'

// Human-authorized disposition on 2026-10-18 for this exact Reader chain only.
// Authority is retrieved below, never supplied by an acceptance flag/file.
function matchesAuthorizedWithdrawal(item,authority) {
  const github=authority?.github,cve=authority?.cve
  return item.github_advisory_id===withdrawnGhsa&&item.module_name==='sprintf-js'&&item.severity==='moderate'&&item.vulnerable_versions==='<=1.1.3'
    &&Array.isArray(item.findings)&&item.findings.length>0&&item.findings.every(entry=>entry.version==='1.0.3'&&entry.dev===false&&entry.optional===false&&entry.bundled===false
      &&Array.isArray(entry.paths)&&entry.paths.length>0&&entry.paths.every(path=>['.>mammoth>argparse>sprintf-js','.>dsh-files>mammoth>argparse>sprintf-js'].includes(path)))
    &&github?.ghsa_id===withdrawnGhsa&&github.cve_id===withdrawnCve&&github.severity==='medium'
    &&Array.isArray(github.vulnerabilities)&&github.vulnerabilities.length===1
    &&github.vulnerabilities[0]?.package?.ecosystem==='npm'&&github.vulnerabilities[0].package.name==='sprintf-js'
    &&github.vulnerabilities[0].vulnerable_version_range==='<= 1.1.3'
    &&cve?.dataType==='CVE_RECORD'&&cve.cveMetadata?.cveId===withdrawnCve&&cve.cveMetadata.state==='REJECTED'
    &&cve.cveMetadata.assignerOrgId===cna&&cve.cveMetadata.dateRejected==='2026-10-12T19:33:32.335Z'
    &&cve.containers?.cna?.providerMetadata?.orgId===cna
}

export function reviewConsumerAudit(report,authority) {
  assert.ok(report?.advisories&&typeof report.advisories==='object'&&!Array.isArray(report.advisories),'complete audit advisories required')
  const counts=report.metadata?.vulnerabilities
  assert.deepEqual(Object.keys(counts??{}).sort(),[...levels].sort(),'complete audit severity counts required')
  const findings=Object.values(report.advisories)
  for(const level of levels){
    assert.ok(Number.isSafeInteger(counts[level])&&counts[level]>=0,'invalid audit severity count')
    assert.equal(counts[level],findings.filter(item=>item.severity===level).length,'audit counts must match findings')
  }
  assert.ok(findings.every(item=>levels.includes(item.severity)),'unknown audit severity')
  const withdrawn=[],unresolved=[]
  for(const item of findings){
    if(matchesAuthorizedWithdrawal(item,authority))withdrawn.push({id:withdrawnGhsa,cve:withdrawnCve,state:'CNA_REJECTED'})
    else unresolved.push({id:item.github_advisory_id??String(item.id),module:item.module_name})
  }
  return {passed:unresolved.length===0,rawAuditPassed:findings.length===0,withdrawn,unresolved,rawVulnerabilities:counts}
}

export async function fetchWithdrawalAuthority() {
  const records=[]
  const data={}
  for(const [name,url] of [
    ['github',`https://api.github.com/advisories/${withdrawnGhsa}`],
    ['cve',`https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/2026/97xxx/${withdrawnCve}.json`],
  ]){
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{accept:'application/json','user-agent':'dsh-files-qualification'}})
    assert.equal(response.status,200,'audit authority must return HTTP 200')
    assert.ok(response.body,'audit authority must return a body')
    const reader=response.body.getReader(),chunks=[]
    let size=0
    try {
      while(true){
        const {done,value}=await reader.read()
        if(done)break
        size+=value.byteLength
        assert.ok(size<=1024*1024,'audit authority response exceeds budget')
        chunks.push(value)
      }
    } finally {await reader.cancel();reader.releaseLock()}
    const bytes=Buffer.concat(chunks)
    data[name]=JSON.parse(bytes.toString('utf8'))
    records.push({url,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,rawBase64:bytes.toString('base64'),body:data[name]})
  }
  return {...data,observedAt:new Date().toISOString(),records}
}
