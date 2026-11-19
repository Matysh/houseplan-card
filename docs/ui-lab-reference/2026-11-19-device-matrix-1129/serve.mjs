import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url));
function option(name,fallback){const at=process.argv.indexOf(name);return at<0?fallback:process.argv[at+1];}
const repo=resolve(option('--repo',process.cwd()));
const port=Number(option('--port',8890));
const {createLabServer}=await import(pathToFileURL(resolve(repo,'demo/ui-lab/server.mjs')));
const server=createLabServer({repoRoot:repo,port,haCache:option('--ha-cache',undefined),fixture:resolve(here,'fixture.json')});
// This fixture is generated exclusively from the public demo, without owner data.
server.provenance.privateDataset=false;
server.provenance.datasetId='synthetic-1129-'+createHash('sha256').update(readFileSync(resolve(here,'fixture.json'))).digest('hex').slice(0,24);
const native=server.listeners('request')[0];server.removeListener('request',native);
server.on('request',(req,res)=>{
 if(!new RegExp('^(localhost|127\\.0\\.0\\.1)(:'+port+')?$').test(req.headers.host||'')||!['GET','HEAD'].includes(req.method)){res.writeHead(403).end();return;}
 const path=req.url.split('?')[0];
 if(['/matrix.mjs','/matrix.json','/MATRIX.md'].includes(path)){
  const data=readFileSync(resolve(here,path.slice(1)));
  res.writeHead(200,{'Content-Type':path.endsWith('.mjs')?'text/javascript; charset=utf-8':path.endsWith('.json')?'application/json; charset=utf-8':'text/plain; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);return;
 }
 if(path==='/app.mjs'){
  const head=res.writeHead.bind(res),end=res.end.bind(res);let status,headers;
  res.writeHead=(code,h)=>{status=code;headers=h;return res;};
  res.end=(body,...args)=>{if(status===200&&body){body=Buffer.from(body.toString()+"\nimport('/matrix.mjs').catch(console.error);\n");headers={...headers,'Content-Length':body.length};delete headers.ETag;}head(status,headers);return end(body,...args);};
 }
 native(req,res);
});
server.listen(port,'127.0.0.1',()=>console.log('UI Lab #1129: http://localhost:'+port));
for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>server.close());
