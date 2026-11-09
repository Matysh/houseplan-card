import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {assetPath,patchPicker} from './mdi-picker-patch.mjs';
import {tapAssetPath,patchMenuTap} from './mobile-menu-tap-patch.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(readFileSync(resolve(root,'lab-config.json'),'utf8'));
const {createLabServer}=await import(pathToFileURL(resolve(config.productPath,'demo/ui-lab/server.mjs')));
const original=readFileSync(resolve(config.productPath,'dist',assetPath.slice('/assets/'.length)),'utf8');
const patched=Buffer.from(patchPicker(original));
const tapPatched=Buffer.from(patchMenuTap(readFileSync(resolve(config.productPath,'dist',tapAssetPath.slice('/assets/'.length)),'utf8')));
const server=createLabServer({repoRoot:config.productPath,port:8890,haCache:config.haCache,fixture:resolve(root,config.fixtureFile),assets:resolve(root,'owner-assets'),theme:resolve(root,'owner-theme.css')});
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
        else{const data=JSON.parse(body);data.prototypeOverrides=true;data.prototype='Pending #1375 MDI picker polish and shared mobile menu tap paint';body=Buffer.from(JSON.stringify(data));}
        headers={...headers,'Content-Length':Buffer.byteLength(body),'X-UI-Lab-Prototype':'mdi-picker-1375'};delete headers.ETag;
      }
      writeHead(status,headers);return end(body,...args);
    };
  }
  request(req,res);
});
server.listen(8890,'127.0.0.1',()=>console.log('UI Lab: http://localhost:8890/ — pending MDI picker #1375 polish'));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close());
