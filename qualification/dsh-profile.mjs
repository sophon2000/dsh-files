import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir,writeFile,readFile,symlink,realpath,mkdtemp } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const [hostArg,artifactArg,rootArg]=process.argv.slice(2);
if (!hostArg || !artifactArg) throw new Error('Usage: node qualification/dsh-profile.mjs <DSH plugins root> <absolute tgz> [new evidence directory]');
const host=await realpath(hostArg);
const artifact=await realpath(artifactArg);
const created=rootArg ?? await mkdtemp(`${tmpdir()}/dsh-files-fork-qualification-`);
await mkdir(created,{recursive:true});
const root=await realpath(created);
const { environmentWithoutSecrets,startLoggedProcess,stopProcess,waitForOutput,waitForHttpReady,rpc,history,authenticatedWebHeaders }=await import(pathToFileURL(`${host}/tests/integration/harness.ts`).href);
const { replaySession }=await import(pathToFileURL(`${host}/tests/integration/replay-session.ts`).href);
const require=createRequire(import.meta.url);
const hostRequire=createRequire(`${host}/package.json`);
const JSZip=require('jszip');
const yaml=hostRequire('js-yaml');
const env=environmentWithoutSecrets({DSH_HOME:`${root}/dsh-home`,DSH_AGENTS_HOME:`${root}/agents`,PATH:`${host}/node_modules/.bin:${process.env.PATH}`,npm_config_ignore_scripts:'true'});
console.log('Isolated evidence directory:',root);
await promisify(execFile)(`${host}/node_modules/.bin/dsh`,['plugin','--profile','web','add',artifact],{cwd:root,env,timeout:120000,maxBuffer:4*1024*1024});
const audit=await promisify(execFile)(process.execPath,[`${host}/node_modules/pnpm/bin/pnpm.cjs`,'--dir',`${root}/dsh-home/profiles/web`,'audit','--prod','--json'],{env,timeout:60000,maxBuffer:4*1024*1024});
await writeFile(`${root}/consumer-audit.json`,audit.stdout);
assert.equal(Object.keys(JSON.parse(audit.stdout).advisories??{}).length,0,'consumer dependency audit must pass');
const licenses=await promisify(execFile)(process.execPath,[`${host}/node_modules/pnpm/bin/pnpm.cjs`,'--dir',`${root}/dsh-home/profiles/web`,'licenses','list','--prod','--json'],{env,timeout:60000,maxBuffer:4*1024*1024});
// Package metadata inventory, not legal clearance. pnpm's reported virtual-store
// paths may not exist in DSH's materialized node_modules, so do not present them as file evidence.
const licenseInventory=Object.fromEntries(Object.entries(JSON.parse(licenses.stdout)).map(([license,packages])=>[
 license,packages.map(({name,versions,license:expression})=>({name,versions,license:expression}))
]));
await writeFile(`${root}/consumer-licenses.json`,JSON.stringify(licenseInventory,null,2));
const ws=`${root}/workspace`;
await mkdir(ws,{recursive:true});
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const zip=new JSZip();
zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>');
zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
zip.file('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="分镜" sheetId="1" r:id="rId1"/><sheet name="配音" sheetId="2" r:id="rId2"/></sheets></workbook>');
zip.file('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+[1,2].map(i=>`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('')+'</Relationships>');
for(const i of [1,2]) {
 const rows=i===1?Array.from({length:210},(_,n)=>[`镜头${n+1}`,n===0?'第一行\n第二行':`要求${n+1}`]):[['配音','HELLO_VOICE']];
 zip.file(`xl/worksheets/sheet${i}.xml`,'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((r,n)=>`<row r="${n+1}">`+r.map((v,c)=>`<c r="${String.fromCharCode(65+c)}${n+1}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>');
}
await writeFile(`${ws}/分镜.xlsx`,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
const docx=new JSZip();
docx.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
docx.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
docx.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>文档测试 DOCX_OK</w:t></w:r></w:p></w:body></w:document>');
await writeFile(`${ws}/需求.docx`,await docx.generateAsync({type:'nodebuffer'}));
// Tiny, deterministic one-page PDF, no external assets or parser used to create it.
const stream='BT /F1 12 Tf 30 100 Td (PDF_OK) Tj ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
let pdf='%PDF-1.4\n'; const offsets=[0];
objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});
const xref=Buffer.byteLength(pdf);
pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF\n`;
await writeFile(`${ws}/sample.pdf`,pdf);
await writeFile(`${ws}/文本.txt`,'alpha\nbeta\ngamma\n');
await writeFile(`${ws}/large.txt`,'x'.repeat(25*1024*1024));
await writeFile(`${ws}/fake.xlsx`,Buffer.from([0x4d,0x5a,0,1,2,0]));
await writeFile(`${ws}/blocked.txt`,'POLICY_SENTINEL_MUST_NOT_LEAK');
await writeFile(`${root}/outside.txt`,'SYNTHETIC_OUTSIDE');
try {await symlink(`${root}/outside.txt`,`${ws}/outside-link.txt`);} catch(e){if(e.code!=='EEXIST')throw e;}
const uploadBytes=await readFile(`${ws}/分镜.xlsx`);
const uploadDigest=createHash('sha256').update(uploadBytes).digest('hex');
const uploadedPath=`${root}/dsh-home/attachments/v1/files/${uploadDigest.slice(0,2)}/${uploadDigest}/原生上传.xlsx`;
const cases=[
 ['native_upload',{file_path:uploadedPath,sheet:2}],
 ['sheets',{file_path:'分镜.xlsx',list_sheets:true}],
 ['sheet2',{file_path:'分镜.xlsx',sheet:2}],
 ['page',{file_path:'分镜.xlsx',sheet:1,offset:203,limit:5}],
 ['rowcap',{file_path:'分镜.xlsx'}],
 ['text',{file_path:'文本.txt',offset:2,limit:1}],
 ['docx',{file_path:'需求.docx'}],
 ['pdf',{file_path:'sample.pdf'}],
 ['fake',{file_path:'fake.xlsx'}],
 ['missing',{file_path:'missing.xlsx'}],
 ['oversize',{file_path:'large.txt'}],
 ['bad_sheet',{file_path:'分镜.xlsx',sheet:99}],
 ['conflict',{file_path:'分镜.xlsx',sheet:1,list_sheets:true}],
 ['bad_offset',{file_path:'文本.txt',offset:0}],
 ['denied',{file_path:'blocked.txt'}],
 ['outside',{file_path:`${root}/outside.txt`}],
 ['symlink',{file_path:'outside-link.txt'}],
 ['native_read',{file_path:`${root}/outside.txt`},'read'],
];
const rows=[{type:'session',version:0,id:'document-qualification',createdAt:1,cwd:'{{cwd}}',delegationDepth:0}];
cases.forEach(([id,args,name='read_document'],index)=>{
 const step=index+1;
 for(const chunk of [
 {type:'block-start',index:0,blockType:'tool-call'},
 {type:'tool-call-delta',index:0,id,name,argumentsDelta:JSON.stringify(args)},
 {type:'block-end',index:0,block:{type:'tool-call',id,name,arguments:JSON.stringify(args)}},
 {type:'finish',reason:{kind:'tool-calls'}}
 ]) rows.push({type:'assistant/chunk',data:{turn:1,step,chunk}});
});
for(const chunk of [{type:'block-start',index:0,blockType:'text'},{type:'text-delta',index:0,text:'QUALIFICATION_DONE'},{type:'block-end',index:0,block:{type:'text',text:'QUALIFICATION_DONE'}},{type:'finish',reason:{kind:'stop'}}])rows.push({type:'assistant/chunk',data:{turn:1,step:cases.length+1,chunk}});
await writeFile(`${root}/replay.jsonl`,replaySession(rows));
await writeFile(`${root}/deny.mjs`,"export const inject=['tools']; export function apply(ctx){ctx.on('tools/pre-execute',async(exec,next)=>exec.name==='read_document'&&exec.arguments.file_path==='blocked.txt'?{kind:'deny',reason:'qualification deliberate denial'}:next());}\n");
await writeFile(`${root}/overlay.yml`,yaml.dump([
 {id:'llm-deepseek',name:'@deepseek-ai/dsh-llm-deepseek',disabled:true},
 {id:'llm-pi-ai',name:'@deepseek-ai/dsh-llm-pi-ai',disabled:true},
 {id:'session-title-llm',name:'@deepseek-ai/dsh-session-title-first-prompt-llm',disabled:true},
 {insert:[{id:'qualification-deny',name:`${root}/deny.mjs`},{id:'llm-replay',name:hostRequire.resolve('@deepseek-ai/dsh-llm-replay'),config:{file:`${root}/replay.jsonl`,providers:[{id:'deepseek-official',name:'Replay',models:[{id:'deepseek-v4-flash',contextWindow:128000,inputModalities:['text']}]}]}}]}
],{noRefs:true}));
const start=()=>startLoggedProcess(`${host}/node_modules/.bin/dsh`,['--profile','web','--patch',`${root}/overlay.yml`,'--no-open','--host','127.0.0.1','--port','0'],{cwd:ws,env:environmentWithoutSecrets({DSH_HOME:`${root}/dsh-home`,DSH_AGENTS_HOME:`${root}/agents`,PATH:`${host}/node_modules/.bin:${process.env.PATH}`})});
let proc=start();
try {
 const launch=await waitForOutput(proc,/dsh web: (http:\/\/[^\s]+)/u,30000);
 const base=await waitForHttpReady(launch,15000);
 const workspace=await rpc(base,'workspace/create',{path:ws});
 const session=await rpc(base,'session/create',{workspaceId:workspace.workspace.workspaceId});
 const uploadResponse=await fetch(`${base}/api/session/uploadFileBinary?sessionId=${session.sessionId}&name=${encodeURIComponent('原生上传.xlsx')}`,{method:'POST',headers:{...authenticatedWebHeaders(base),'content-type':'application/octet-stream'},body:uploadBytes});
 const upload=await uploadResponse.json();assert.equal(upload.ok,true);assert.equal(upload.value.file.attachmentId,`sha256:${uploadDigest}`);
 const other=await rpc(base,'session/create',{workspaceId:workspace.workspace.workspaceId});
 await assert.rejects(rpc(base,'session/prompt',{requestId:randomUUID(),sessionId:other.sessionId,mode:'queue',content:[{type:'file',receiptId:upload.value.receiptId}]}),/File was not uploaded for this session/);
 await rpc(base,'session/selectModel',{sessionId:session.sessionId,provider:'deepseek-official',model:'deepseek-v4-flash'});
 await rpc(base,'session/prompt',{requestId:randomUUID(),sessionId:session.sessionId,mode:'queue',content:[{type:'text',text:'Run the synthetic document qualification.'},{type:'file',receiptId:upload.value.receiptId}]});
 let result;const deadline=Date.now()+60000;
 do{result=await history(base,session.sessionId);if(JSON.stringify(result).includes('QUALIFICATION_DONE'))break;await new Promise(r=>setTimeout(r,200));}while(Date.now()<deadline);
 await writeFile(`${root}/history.json`,JSON.stringify(result,null,2));
 const events=result.events.filter(e=>e.event.type==='tool/result');
 assert.equal(events.length,cases.length,'all calls must produce real Tool results');
 const results=new Map(events.map(e=>{const d=e.event.data;const r=d.message.content.find(c=>c.type==='tool-result');return [r.toolCallId,{error:r.isError,text:r.content.map(c=>c.text??'').join('\n'),meta:d.meta,code:d.error?.code}];}));
 for(const id of ['native_upload','sheets','sheet2','page','rowcap','text','docx','pdf','outside','symlink','native_read'])assert.equal(results.get(id).error,false,id);
 for(const id of ['fake','missing','oversize','bad_sheet','conflict','bad_offset','denied'])assert.equal(results.get(id).error,true,id);
 assert.match(results.get('sheets').text,/1\. 分镜\n2\. 配音/);
 for(const id of ['native_upload','sheet2'])assert.match(results.get(id).text,/HELLO_VOICE/);
 assert.match(results.get('page').text,/镜头205/);assert.equal(results.get('page').meta.lines.length,5);
 assert.match(results.get('rowcap').text,/已截断/);assert.doesNotMatch(results.get('rowcap').text,/镜头201/);
 assert.match(results.get('rowcap').text,/第一行 第二行/);
 assert.equal(results.get('text').meta.lines[0].text,'beta');
 assert.match(results.get('docx').text,/DOCX_OK/);assert.match(results.get('pdf').text,/PDF_OK/);
 assert.equal(results.get('fake').code,'FS_NOT_TEXT');assert.equal(results.get('missing').code,'FS_NOT_FOUND');assert.equal(results.get('oversize').code,'FS_TOO_LARGE');
 assert.doesNotMatch(JSON.stringify(result),/POLICY_SENTINEL_MUST_NOT_LEAK/);
 for(const id of ['outside','symlink','native_read'])assert.match(results.get(id).text,/SYNTHETIC_OUTSIDE/);
 assert.equal(createHash('sha256').update(await readFile(`${ws}/分镜.xlsx`)).digest('hex'),uploadDigest);
 await stopProcess(proc);
 proc=start();
 const coldLaunch=await waitForOutput(proc,/dsh web: (http:\/\/[^\s]+)/u,30000);
 const coldBase=await waitForHttpReady(coldLaunch,15000);
 const cold=await history(coldBase,session.sessionId);
 assert.deepEqual(cold.events.filter(e=>e.event.type==='tool/result'),events);
 const summary={artifactSha256:createHash('sha256').update(await readFile(artifact)).digest('hex'),sessionId:session.sessionId,toolCases:cases.length,nativeUpload:true,foreignReceiptDenied:true,policyDenied:true,sourceUnchanged:true,coldHistoryIdentical:true,results:[...results].map(([id,r])=>({id,isError:r.error,code:r.code}))};
 await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary,null,2));
} finally {await stopProcess(proc);await writeFile(`${root}/verify.log`,proc.output().replace(/(token=)[^\s&]+/g,'$1[redacted]'));}
