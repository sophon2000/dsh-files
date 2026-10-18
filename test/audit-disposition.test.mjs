import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reviewConsumerAudit,fetchWithdrawalAuthority } from '../qualification/audit-disposition.mjs'
import { createHash } from 'node:crypto'

// Factual identifiers from the public CVE/GHSA records; these fixtures never
// grant authority to qualification, which must retrieve fresh HTTPS records.
const finding={github_advisory_id:'GHSA-hp3w-g68c-fv3c',module_name:'sprintf-js',severity:'moderate',vulnerable_versions:'<=1.1.3',findings:[{version:'1.0.3',paths:['.>dsh-files>mammoth>argparse>sprintf-js'],dev:false,optional:false,bundled:false}]}
const authority={
  github:{ghsa_id:'GHSA-hp3w-g68c-fv3c',cve_id:'CVE-2026-97058',severity:'medium',vulnerabilities:[{package:{ecosystem:'npm',name:'sprintf-js'},vulnerable_version_range:'<= 1.1.3'}]},
  cve:{dataType:'CVE_RECORD',cveMetadata:{cveId:'CVE-2026-97058',state:'REJECTED',assignerOrgId:'83251b91-4cc7-4094-a5c7-464a1b83ea10',dateRejected:'2026-10-12T19:33:32.335Z'},containers:{cna:{providerMetadata:{orgId:'83251b91-4cc7-4094-a5c7-464a1b83ea10'}}}},
}
function report(items=[finding]){
  const vulnerabilities={info:0,low:0,moderate:0,high:0,critical:0}
  for(const item of items)vulnerabilities[item.severity]++
  return {advisories:Object.fromEntries(items.map((item,index)=>[index,item])),metadata:{vulnerabilities}}
}

test('clean audit passes without an authority exception',()=>{
  const result=reviewConsumerAudit(report([]))
  assert.equal(result.passed,true);assert.equal(result.rawAuditPassed,true)
  assert.deepEqual(result.withdrawn,[])
})
test('only the authorized finding with matching live CNA rejection is disposed',()=>{
  const input=report(),before=structuredClone(input)
  const result=reviewConsumerAudit(input,authority)
  assert.equal(result.passed,true);assert.equal(result.rawAuditPassed,false)
  assert.deepEqual(result.withdrawn,[{id:'GHSA-hp3w-g68c-fv3c',cve:'CVE-2026-97058',state:'CNA_REJECTED'}])
  assert.deepEqual(result.unresolved,[]);assert.deepEqual(input,before)
})
test('an additional real advisory still blocks the audit',()=>{
  const result=reviewConsumerAudit(report([finding,{...finding,github_advisory_id:'GHSA-other-unknown',module_name:'other',severity:'high'}]),authority)
  assert.equal(result.passed,false)
  assert.equal(result.unresolved[0].id,'GHSA-other-unknown')
})
test('missing, mismatched, renewed or changed authoritative records cannot dispose a finding',()=>{
  const variants=[undefined,{},structuredClone(authority),structuredClone(authority),structuredClone(authority),structuredClone(authority),structuredClone(authority)]
  variants[2].github.cve_id='CVE-OTHER'
  variants[3].cve.cveMetadata.state='PUBLISHED'
  variants[4].cve.cveMetadata.cveId='CVE-OTHER'
  variants[5].cve.cveMetadata.dateRejected='2026-10-18T00:00:00Z'
  variants[6].github.vulnerabilities[0].package.name='other'
  for(const value of variants)assert.equal(reviewConsumerAudit(report(),value).passed,false)
})
test('another module, version, severity or dependency chain is outside the authorized disposition',()=>{
  for(const change of [
    {module_name:'other'}, {severity:'high'}, {vulnerable_versions:'*'},
    {findings:[{...finding.findings[0],version:'1.1.3'}]},
    {findings:[{...finding.findings[0],paths:['.>unrelated>sprintf-js']}]},
    {findings:[]},
  ])assert.equal(reviewConsumerAudit(report([{...finding,...change}]),authority).passed,false)
})
test('missing or contradictory audit counts fail closed',()=>{
  assert.throws(()=>reviewConsumerAudit({}),/complete audit/)
  const input=report();input.metadata.vulnerabilities.moderate=0
  assert.throws(()=>reviewConsumerAudit(input,authority),/counts must match/)
})

test('saved authority evidence reproduces the exact HTTP bytes and their hashes',async()=>{
  const original=globalThis.fetch
  const bytes=Buffer.from(' { "escaped": "\\u4e2d", "literal": "中文" }\n','utf8')
  globalThis.fetch=async()=>new Response(bytes,{status:200})
  try {
    const result=await fetchWithdrawalAuthority()
    assert.equal(result.records.length,2)
    for(const record of result.records){
      assert.equal(record.rawBase64,bytes.toString('base64'))
      const recovered=Buffer.from(record.rawBase64,'base64')
      assert.equal(recovered.length,record.bytes)
      assert.equal(createHash('sha256').update(recovered).digest('hex'),record.sha256)
      assert.deepEqual(JSON.parse(recovered.toString('utf8')),record.body)
    }
  } finally {globalThis.fetch=original}
})

test('authority HTTP errors and oversized bodies cannot produce accepted evidence',async()=>{
  const original=globalThis.fetch
  try {
    globalThis.fetch=async()=>new Response('{}',{status:503})
    await assert.rejects(fetchWithdrawalAuthority(),/HTTP 200/)
    globalThis.fetch=async()=>new Response(new Uint8Array(1024*1024+1),{status:200})
    await assert.rejects(fetchWithdrawalAuthority(),/exceeds budget/)
  } finally {globalThis.fetch=original}
})
