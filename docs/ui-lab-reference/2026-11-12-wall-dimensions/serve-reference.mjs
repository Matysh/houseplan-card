import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url)),args=process.argv.slice(2),values={};
for(let i=0;i<args.length;i+=2){
  if(!['--repo','--ha-cache','--port'].includes(args[i])||!args[i+1])throw Error('Usage: --repo <checkout> [--ha-cache <cache>] [--port 8892]');
  values[args[i]]=args[i+1];
}
if(!values['--repo'])throw Error('--repo required');
const repoRoot=resolve(values['--repo']),port=Number(values['--port']||8892);
const baseline=JSON.parse(readFileSync(resolve(root,'BASELINE.json'),'utf8'));
if(execFileSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'}).trim()!==baseline.commit)throw Error('Use pinned commit '+baseline.commit);
const {createLabServer}=await import(pathToFileURL(resolve(repoRoot,'demo/ui-lab/server.mjs')));
const server=createLabServer({repoRoot,port,...(values['--ha-cache']?{haCache:resolve(values['--ha-cache'])}:{})});
const native=server.listeners('request')[0];server.removeListener('request',native);
server.on('request',(req,res)=>{
  const path=req.url.split('?')[0];
  if(path==='/native-proposals.mjs'){
    if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)||!['GET','HEAD'].includes(req.method)){res.writeHead(403).end();return;}
    const bytes=readFileSync(resolve(root,'accepted/native-proposals.mjs'));
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:bytes);return;
  }
  if(path==='/app.mjs'){
    const head=res.writeHead.bind(res),end=res.end.bind(res);let status,headers;
    res.writeHead=(code,h)=>{status=code;headers=h;return res;};
    res.end=(body,...args)=>{
      if(status===200&&body){body=Buffer.from('globalThis.__hpNativePrototypes=true;\n'+body.toString()+"\nawait import('/native-proposals.mjs');\n");headers={...headers,'Content-Length':body.length};delete headers.ETag;}
      head(status,headers);return end(body,...args);
    };
  }
  native(req,res);
});
server.listen(port,'127.0.0.1',()=>console.log(`Accepted #1381 reference: http://localhost:${port}/ (synthetic data)`));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close());
