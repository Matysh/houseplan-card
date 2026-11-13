# Воспроизведение исследовательского probe #1393

Это исследовательская программа, не продуктовый тест и не standalone entry. Основные выводы и ограничения — в [отчёте](1393-ha-components.md).

В checkout исходного SHA из measurement JSON нужны установленные зависимости проекта, подготовленный закреплённый UI Lab HA cache и существующий валидный `dist` для запуска read-only UI Lab server. Из `dist` в измеряемую страницу не загружается ни один продуктовый JS: страницы пробника перехватываются Playwright. Загрузка данных настоящего HA не используется. Если cache отсутствует, его отдельно подготавливает штатный `ui-lab:prepare`, а не этот probe.

Сохранить код ниже в `artifacts/1393-components.mjs` и выполнить из корня:

```sh
node artifacts/1393-components.mjs
```

Результат — `artifacts/1393/report.json` и временный probe bundle. Программа не меняет tracked source, `dist`, UI Lab fixture, браузерную сессию владельца или реальные данные HA. Временный сервер слушает loopback на свободном порту и закрывается после измерений. Всё за пределами loopback запрещено. Сравниваются одинаковая версия `HpDialog`, одинаковый набор input/select/кнопки, CSS и шрифты; native-ветка использует только исследовательский конечный SVG значка закрытия. Шим не является продуктовой реализацией всех `ha-icon`.

Статический инвентарь считает только сегменты tagged templates `html`/`svg` через AST TypeScript; комментарии и CSS-селекторы не выдаются за отрисованные компоненты. Отдельный счёт упоминаний намеренно шире. Runtime-зависимости HA-контейнера рассматриваются в основном отчёте.

```js
/** Read-only source/asset inventory and isolated bootstrap measurement, not product acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {rollup} from 'rollup';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import ts from 'typescript';
import {chromium} from 'playwright';
import {createLabServer} from '../demo/ui-lab/server.mjs';

const root=process.cwd(), out=path.join(root,'artifacts/1393');
fs.mkdirSync(out,{recursive:true});
const sources=execFileSync('git',['ls-files','src'],{encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.ts'));
const tags=new Map(), allMentions=new Set();
for(const file of sources){
  const text=fs.readFileSync(file,'utf8');
  if(/\bha-[a-z][\w-]*/.test(text))allMentions.add(file);
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const visit=node=>{
    if(ts.isTaggedTemplateExpression(node)&&['html','svg'].includes(node.tag.getText(source))){
      const parts=ts.isNoSubstitutionTemplateLiteral(node.template)?[node.template]:[node.template.head,...node.template.templateSpans.map(s=>s.literal)];
      for(const part of parts)for(const match of part.text.matchAll(/<(?<tag>ha-[a-z][a-z0-9-]*)(?=[\s>])/g)){
        const rows=tags.get(match.groups.tag)||[];
        rows.push({file,line:source.getLineAndCharacterOfPosition(part.getStart(source)+match.index).line+1});tags.set(match.groups.tag,rows);
      }
    }
    ts.forEachChild(node,visit);
  };visit(source);
}
const lock=JSON.parse(fs.readFileSync('demo/ui-lab/ha-lock.json'));
const cache=path.join(os.homedir(),'.cache/houseplan-ui-lab',lock.version);
const manifest=JSON.parse(fs.readFileSync(path.join(cache,'manifest.json')));
function closure(ids){
  const visited=new Set(),files=new Set([`hass_frontend/frontend_latest/${lock.app}`]);
  const walk=id=>{if(visited.has(id))return;visited.add(id);const item=manifest.modules[id];if(!item)return;files.add(item.file.startsWith('hass_frontend/')?item.file:`hass_frontend/frontend_latest/${item.file}`);for(const dep of item.dependencies)walk(dep);};
  ids.forEach(walk);const buffers=[...files].map(file=>fs.readFileSync(path.join(cache,file)));
  return{modules:visited.size,files:[...files].sort(),bytes:buffers.reduce((s,b)=>s+b.length,0),gzipBytes:buffers.reduce((s,b)=>s+gzipSync(b).length,0)};
}
const all=closure(Object.values(lock.modules)),reduced=closure([lock.modules.theme,lock.modules.dialog,lock.modules.icon,lock.modules.contexts]);
const entry=`import {HpDialog} from './src/hp-dialog';
import {settingsActionsCss} from './src/styles/settings-action.styles';
const native=new URLSearchParams(location.search).get('variant')==='native';
if(native&&!customElements.get('ha-icon')){class ProbeIcon extends HTMLElement{connectedCallback(){this.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.41 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.3-6.29z"/></svg>';}}customElements.define('ha-icon',ProbeIcon);}
const style=document.createElement('style');style.textContent=settingsActionsCss('.probe-action')+'input,select{font:inherit;padding:8px}';document.head.append(style);
const dialog=new HpDialog();dialog.title='Plan properties';dialog.setAttribute('form-shell','');dialog.setAttribute('compact','');dialog.innerHTML='<label>Name <input value="Test room"></label><label>Style <select><option>Solid</option><option>Dashed</option></select></label><button class="probe-action" id="probe-save" slot="footer">Save</button>';
dialog.addEventListener('hp-close',()=>dialog.remove());document.body.append(dialog);await dialog.updateComplete;
const shell=dialog.shadowRoot.querySelector('ha-dialog');if(shell?.updateComplete)await shell.updateComplete;
await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
window.__probeReady={elapsed:performance.now(),native:!!dialog.shadowRoot.querySelector('dialog'),ha:!!shell,bodyWidth:dialog.getBoundingClientRect().width};`;
const entryId='\0hp-1393-probe';
const compiled=await rollup({input:entryId,plugins:[{name:'research-entry',resolveId:id=>id===entryId?entryId:null,load:id=>id===entryId?entry.replaceAll("from './src/",`from '${root}/src/`):null,transform:(code,id)=>id.endsWith('.ts')?ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,useDefineForClassFields:false}}).outputText:null},nodeResolve({browser:true,extensions:['.js','.ts']}),terser()]});
const bundle=Buffer.from((await compiled.generate({format:'esm'})).output[0].code);await compiled.close();
fs.writeFileSync(path.join(out,'probe.js'),bundle);
const server=createLabServer({port:0});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const samples=[];
try{
  for(const variant of ['full','reduced','native'])for(let run=0;run<5;run++){
    const context=await browser.newContext({viewport:{width:1280,height:900},locale:'en-US',reducedMotion:'reduce'});
    const page=await context.newPage(),requests=[],errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',async response=>{try{const headers=await response.allHeaders();requests.push({path:new URL(response.url()).pathname,status:response.status(),bytes:Number(headers['content-length']||0)});}catch{}});
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin){errors.push('external request: '+url.origin);await route.abort();return;}
      if(url.pathname==='/1393.html'){
        const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/theme.css"></head><body><script type="module">window.__labLanguage='en';${variant==='native'?'':"await import('/ha-bootstrap.mjs');"}await import('/1393-probe.js');</script></body></html>`;
        await route.fulfill({contentType:'text/html',body:html});return;
      }
      if(url.pathname==='/1393-probe.js'){await route.fulfill({contentType:'text/javascript',body:Buffer.from(bundle)});return;}
      if(url.pathname==='/ha-bootstrap.mjs'&&variant==='reduced'){
        const body=fs.readFileSync('demo/ui-lab/ha-bootstrap.mjs','utf8').replace('runtime.modules.icon, runtime.modules.card, runtime.modules.contexts','runtime.modules.icon, runtime.modules.contexts').replace("['ha-dialog', 'ha-icon', 'ha-card']","['ha-dialog', 'ha-icon']");
        await route.fulfill({contentType:'text/javascript',body});return;
      }
      await route.continue();
    });
    await page.goto(`${origin}/1393.html?variant=${variant}`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__probeReady,{timeout:30000});
    await page.waitForTimeout(250);
    const result=await page.evaluate(()=>({ready:window.__probeReady,resources:performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,bytes:r.decodedBodySize,duration:r.duration}))}));
    const controls=await page.locator('hp-dialog input').count();
    const frameVisible=await page.locator('hp-dialog input').isVisible();
    if(!frameVisible||controls!==1||errors.length)throw Error(JSON.stringify({variant,run,errors,frameVisible,controls}));
    samples.push({variant,run:run+1,...result,requests});
    console.log(JSON.stringify({variant,run:run+1,readyMs:result.ready.elapsed,requests:requests.length,bytes:result.resources.reduce((s,r)=>s+r.bytes,0)}));
    await context.close();
  }
  const median=values=>values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)];
  const summary=Object.fromEntries(['full','reduced','native'].map(variant=>{const s=samples.filter(x=>x.variant===variant);return[variant,{runs:s.length,medianReadyMs:median(s.map(x=>x.ready.elapsed)),medianResourceBytes:median(s.map(x=>x.resources.reduce((n,r)=>n+r.bytes,0))),medianRequests:median(s.map(x=>x.requests.length))}];}));
  const report={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),date:new Date().toISOString(),kind:'bootstrap-probe-not-full-editor',environment:{node:process.version,browser:browser.version(),platform:os.platform(),release:os.release(),cpu:os.cpus()[0].model,cpus:os.cpus().length,viewport:'1280x900',network:'loopback; no throttling; fresh browser context per sample; route interception disables HTTP cache',reducedMotion:true},inventory:{sourceFiles:sources.length,mentionFiles:allMentions.size,tagFiles:new Set([...tags.values()].flat().map(x=>x.file)).size,tags:Object.fromEntries([...tags].sort(([a],[b])=>a.localeCompare(b)))},lock,staticClosures:{full:all,reduced},probe:{bytes:bundle.length,gzipBytes:gzipSync(bundle).length},summary,samples};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({inventory:{tags:[...tags.keys()],files:report.inventory.tagFiles},summary,probe:report.probe},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
```
