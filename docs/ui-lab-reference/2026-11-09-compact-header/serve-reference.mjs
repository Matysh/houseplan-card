import {sheetPatch,applySheetMotion,triggerPatch,menuIconPatch} from './header-sheet-patch.mjs';
import {applyMenuLabels} from './header-menu-labels-patch.mjs';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2), values={};
for(let i=0;i<args.length;i+=2){
  if(!['--repo','--ha-cache','--port'].includes(args[i])||!args[i+1])throw Error('Usage: node serve-reference.mjs --repo <pinned-product-checkout> [--ha-cache <cache>] [--port 8892]');
  values[args[i]]=args[i+1];
}
if(!values['--repo'])throw Error('--repo is required');
const config={productPath:resolve(values['--repo']),haCache:values['--ha-cache']?resolve(values['--ha-cache']):undefined,port:Number(values['--port']||8892)};
const baseline=JSON.parse(readFileSync(resolve(root,'BASELINE.json'),'utf8'));
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:config.productPath,encoding:'utf8'}).trim();
if(commit!==baseline.commit)throw Error('Use the pinned product commit: '+baseline.commit);
const manifest=JSON.parse(readFileSync(resolve(config.productPath,'dist/houseplan-assets.json'),'utf8'));
if(manifest.fingerprint!==baseline.baseBuildFingerprint)throw Error('Base bundle fingerprint differs; do not adapt the accepted artifact silently.');
const {createLabServer}=await import(pathToFileURL(resolve(config.productPath,'demo/ui-lab/server.mjs')));
const patchPath='/assets/houseplan-assets/houseplan-card-DosYJyi9.js';
const before='}(co(l).map(([,e])=>e.getBoundingClientRect()))>=2&&(s={phase:5,phone:!1}';
const after=before.replace('>=2&&','>=3&&');
const original=readFileSync(resolve(config.productPath,'dist/houseplan-assets/houseplan-card-DosYJyi9.js'),'utf8');
if(original.split(before).length!==2) throw Error('Header prototype no longer matches the pinned dev bundle');
if(original.split(triggerPatch.before).length!==2) throw Error('Header trigger prototype no longer matches the dev bundle');
if(original.split(menuIconPatch.before).length!==2) throw Error('Panel menu icon no longer matches the dev bundle');
const server=createLabServer({repoRoot:config.productPath,port:config.port,haCache:config.haCache});
const sheetSource=readFileSync(resolve(config.productPath,'dist',sheetPatch.path.slice('/assets/'.length)),'utf8');
if(sheetSource.split(sheetPatch.before).length!==2) throw Error('Sheet prototype no longer matches the pinned dev bundle');
applySheetMotion(sheetSource);
const actionsPath='/assets/houseplan-assets/header-actions-menu-Dj4g_X0u.js';
const actionsBefore='.filter(t=>t!==e&&"space-tab"!==t.dataset.hp)';
const actionsAfter='.filter(t=>t!==e&&!["space-tab","panel-menu","zoom-out","zoom-fit","zoom-in"].includes(t.dataset.hp))';
const actionsSource=readFileSync(resolve(config.productPath,'dist',actionsPath.slice('/assets/'.length)),'utf8');
if(actionsSource.split(actionsBefore).length!==2) throw Error('Header menu action filter no longer matches the dev bundle');
applyMenuLabels(actionsSource);
const appBefore="document.addEventListener('hass-toggle-menu', () => { tools.hidden = !tools.hidden; });";
const appAfter=appBefore+`
  // The local tools drawer stands in for HA's sidebar in this offline harness.
  const syncSidebarIcon=()=>card.toggleAttribute('data-lab-sidebar-open',!tools.hidden);
  new MutationObserver(syncSidebarIcon).observe(tools,{attributes:true,attributeFilter:['hidden']});
  syncSidebarIcon();`;
const appSource=readFileSync(resolve(config.productPath,'demo/ui-lab/app.mjs'),'utf8');
if(appSource.split(appBefore).length!==2) throw Error('Local sidebar binding no longer matches the dev harness');
const request=server.listeners('request')[0];
server.removeListener('request',request);
server.on('request',(req,res)=>{
  const path=req.url.split('?')[0];
  if(path===patchPath || path===sheetPatch.path || path===actionsPath || path==='/app.mjs' || path==='/health' || path==='/provenance.json') {
    const writeHead=res.writeHead.bind(res),end=res.end.bind(res);
    let status,headers;
    res.writeHead=(code,h)=>{status=code;headers=h;return res;};
    res.end=(body,...args)=>{
      if(status===200 && body) {
        if(path===patchPath) body=Buffer.from(body.toString().replace(before,after).replace(triggerPatch.before,triggerPatch.after).replace(menuIconPatch.before,menuIconPatch.after));
        else if(path===sheetPatch.path) body=Buffer.from(applySheetMotion(body.toString().replace(sheetPatch.before,sheetPatch.after)));
        else if(path===actionsPath) body=Buffer.from(applyMenuLabels(body.toString().replace(actionsBefore,actionsAfter)));
        else if(path==='/app.mjs') body=Buffer.from(body.toString().replace(appBefore,appAfter));
        else {const data=JSON.parse(body);data.prototypeOverrides=true;data.prototype='Accepted reference #1371; two-row header, content-height menu, sidebar states, scene pan and editor column';body=Buffer.from(JSON.stringify(data));}
        headers={...headers,'Content-Length':Buffer.byteLength(body),'X-UI-Lab-Prototype':'header-two-rows'};
        delete headers.ETag;
      }
      writeHead(status,headers);return end(body,...args);
    };
  }
  request(req,res);
});
server.listen(config.port,'127.0.0.1',()=>console.log('Accepted UI Lab reference #1371: http://localhost:'+server.address().port+'/'));
for(const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>server.close());


