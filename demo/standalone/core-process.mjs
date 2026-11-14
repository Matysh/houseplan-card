/** Test-only bridge to the genuine isolated Python core over stdio. */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
export async function createCoreProcess(initial){
  const script=fileURLToPath(new URL('./core_process.py',import.meta.url));
  const child=spawn(process.env.HP_STANDALONE_PYTHON||'python',['-I',script],{stdio:['pipe','pipe','pipe']});
  const pending=new Map();let seq=0,stderr='';
  child.stderr.on('data',bytes=>{stderr=(stderr+bytes).slice(-8000);});
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
    const reply=JSON.parse(line),wait=pending.get(reply.id);if(!wait)return;
    pending.delete(reply.id);clearTimeout(wait.timer);
    reply.error?wait.reject(Object.assign(new Error(reply.error.message),{code:reply.error.code})):wait.resolve(reply);
  });
  const fail=error=>{for(const wait of pending.values()){clearTimeout(wait.timer);wait.reject(error);}pending.clear();};
  child.on('error',fail);child.on('exit',code=>fail(Error(`Standalone test core exited ${code}: ${stderr}`)));
  const rpc=value=>new Promise((resolve,reject)=>{
    const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Test core request timed out: ${stderr}`));},15000);
    pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({...value,id})+'\n');
  });
  try{const info=await rpc({op:'init',...initial});return {rpc,info:info.result,
    async close(){child.stdin.end();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});lines.close();}};}
  catch(error){child.kill();throw error;}
}
