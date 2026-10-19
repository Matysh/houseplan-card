import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {installHpTestOnPage} from './hp-test.mjs';
import {ensureHarnessEditorRuntime} from '../editor-runtime-compat.mjs';
import {installUiPolish963Fixture} from './ui-polish-963-fixture.mjs';
import {watchPage} from '../serve.mjs';

export const UI_963_BASE = '33a364d82e83963c8dc5bc961ea8f8025cb0a067';
/** A CI smoke checkout is shallow; acquire only the immutable public base. */
export function ensureUi963ReferenceCommit(cwd=fileURLToPath(new URL('../../',import.meta.url))) {
  const options={cwd,encoding:'utf8',timeout:60000};
  try {execFileSync('git',['cat-file','-e',`${UI_963_BASE}^{commit}`],{...options,stdio:'ignore'});}
  catch {
    console.log(`Fetching pinned public #963 reference commit ${UI_963_BASE}`);
    execFileSync('git',['fetch','--no-tags','--depth=1','origin',UI_963_BASE],options);
  }
  return execFileSync('git',['rev-parse',`${UI_963_BASE}^{commit}`],options).trim();
}
const directory = fileURLToPath(new URL('../../docs/design/963-ui-polish/approved-2026-10-19/',import.meta.url));
const verified = (file,hash) => {
  const bytes=readFileSync(directory+file);
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Frozen #963 source changed: '+file);
  return bytes.toString('utf8');
};
export function ui963ApprovedSources() {
  return {
    app:verified('app.mjs','32fb18a3733bf445f76bc06af72cf2eb6f7eda5f28ef30aa3fded55b68f04bc3'),
    css:verified('houseplan-card.css','0774b13e574604fc0137e608fb01736da053ed722f8c1d886c8eafcb959f5c4b'),
  };
}
export async function prepareUi963Page(page,url) {
  await page.goto(url+'/product.html');
  await page.waitForFunction(()=>window.__card?._booting===false&&window.__card?._devices?.length>0);
  if(!await page.evaluate(ensureHarnessEditorRuntime))throw Error('Editor preload failed');
  await installHpTestOnPage(page);await installUiPolish963Fixture(page);
}
/** Serves the original public Git bundle plus exact frozen prototype, never current implementation CSS. */
export async function createUi963Reference(fixture) {
  ensureUi963ReferenceCommit();
  const source=ui963ApprovedSources(), page=watchPage(await fixture.context.newPage());
  const files=new Set(execFileSync('git',['ls-tree','-r','--name-only',UI_963_BASE,'--','dist'],{encoding:'utf8'}).trim().split('\n').map(f=>f.slice(5)));
  const cache=new Map();
  await page.route('**/assets/**',async route=>{
    const name=decodeURIComponent(new URL(route.request().url()).pathname).slice('/assets/'.length);
    if(files.has(name)) {
      if(!cache.has(name))cache.set(name,execFileSync('git',['show',`${UI_963_BASE}:dist/${name}`],{maxBuffer:32*1024*1024}));
      return route.fulfill({status:200,contentType:name.endsWith('.json')?'application/json':'text/javascript',body:cache.get(name)});
    }
    if(/\.(?:js|json)$/.test(name)&&name!=='icons.js')throw Error('Unknown original bundle asset: '+name);
    return route.continue();
  });
  await prepareUi963Page(page,fixture.url);
  const start=source.app.indexOf('  // Local prototype: the header\'s right-hand actions');
  const end=source.app.indexOf('  const apply = () => {',start);
  if(start<0||end<0)throw Error('Frozen prototype boundary missing');
  await page.addScriptTag({content:`(()=>{const card=window.__card;const enabled={checked:true};${source.app.slice(start,end)}\nsyncSidebarGroups();})();`});
  await page.evaluate(css=>{const style=document.createElement('style');style.textContent=css;window.__card.shadowRoot.append(style);},source.css);
  return page;
}
