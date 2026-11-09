import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {assetPath,patchPicker} from './mdi-picker-patch.mjs';
import {tapAssetPath,patchMenuTap} from './mobile-menu-tap-patch.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const argv=process.argv.slice(2),values={};
for(let i=0;i<argv.length;i+=2){if(!['--repo','--ha-cache','--port'].includes(argv[i])||!argv[i+1])throw Error('Usage: node serve-reference.mjs --repo <pinned-checkout> [--ha-cache <cache>] [--port 8892]');values[argv[i]]=argv[i+1];}
if(!values['--repo'])throw Error('--repo required');
const config={productPath:resolve(values['--repo']),haCache:values['--ha-cache']?resolve(values['--ha-cache']):undefined,port:Number(values['--port']||8892)};
const baseline=JSON.parse(readFileSync(resolve(root,'BASELINE.json'),'utf8'));
if(execFileSync('git',['rev-parse','HEAD'],{cwd:config.productPath,encoding:'utf8'}).trim()!==baseline.commit)throw Error('Use pinned product commit '+baseline.commit);
if(JSON.parse(readFileSync(resolve(config.productPath,'dist/houseplan-assets.json'),'utf8')).fingerprint!==baseline.baseBuildFingerprint)throw Error('Base bundle fingerprint differs; do not adapt accepted reference silently.');
const {createLabServer}=await import(pathToFileURL(resolve(config.productPath,'demo/ui-lab/server.mjs')));
const original=readFileSync(resolve(config.productPath,'dist',assetPath.slice('/assets/'.length)),'utf8');
const patched=Buffer.from(patchPicker(original));
const tapPatched=Buffer.from(patchMenuTap(readFileSync(resolve(config.productPath,'dist',tapAssetPath.slice('/assets/'.length)),'utf8')));
const server=createLabServer({repoRoot:config.productPath,port:config.port,haCache:config.haCache});
const request=server.listeners('request')[0];server.removeListener('request',request);
server.on('request',(req,res)=>{
  const path=req.url.split('?')[0];
  if([assetPath,tapAssetPath,'/health','/provenance.json'].includes(path)){
    const writeHead=res.writeHead.bind(res),end=res.end.bind(res);let status,headers;
    res.writeHead=(code,h)=>{status=code;headers=h;return res;};
    res.end=(body,...args)=>{
      if(status===200&&body){
        if(path===assetPath)body=patched;
        else if(path===tapAssetPath)body=tapPatched;
        else{const data=JSON.parse(body);data.prototypeOverrides=true;data.prototype='Accepted #1376 MDI picker polish and shared mobile menu tap paint';body=Buffer.from(JSON.stringify(data));}
        headers={...headers,'Content-Length':Buffer.byteLength(body),'X-UI-Lab-Prototype':'mdi-picker-1375'};delete headers.ETag;
      }
      writeHead(status,headers);return end(body,...args);
    };
  }
  request(req,res);
});
server.listen(config.port,'127.0.0.1',()=>console.log('Accepted #1376 reference: http://localhost:'+server.address().port+'/'));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close());
