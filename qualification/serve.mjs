import { pathToFileURL } from 'node:url';
import { realpath } from 'node:fs/promises';
const [hostArg,rootArg]=process.argv.slice(2);
if(!hostArg||!rootArg)throw new Error('Usage: node qualification/serve.mjs <DSH plugins root> <qualification evidence directory>');
const host=await realpath(hostArg),root=await realpath(rootArg);
const {environmentWithoutSecrets,startLoggedProcess,stopProcess,waitForOutput}=await import(pathToFileURL(`${host}/tests/integration/harness.ts`).href);
const proc=startLoggedProcess(`${host}/node_modules/.bin/dsh`,['--profile','web','--patch',`${root}/overlay.yml`,'--no-open','--host','127.0.0.1','--port','0'],{cwd:`${root}/workspace`,env:environmentWithoutSecrets({DSH_HOME:`${root}/dsh-home`,DSH_AGENTS_HOME:`${root}/agents`})});
process.on('SIGTERM',async()=>{await stopProcess(proc);process.exit(0)});
process.on('SIGINT',async()=>{await stopProcess(proc);process.exit(0)});
try{console.log(await waitForOutput(proc,/dsh web: (http:\/\/[^\s]+)/u,30000));}catch(error){console.error(String(error));await stopProcess(proc);process.exit(1);}
setTimeout(async()=>{await stopProcess(proc);process.exit(0)},300000);
