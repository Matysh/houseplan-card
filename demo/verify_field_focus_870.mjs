// Authentic pinned HA picker + native controls. Explicit offline diagnostic;
// no HA host, no production devices and no replacement component factories.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { formKitCss, CARD_DIALOG_FORM_KIT } from '../test-build/styles/form-kit.styles.js';
import { launchHaDialogFixture } from './helpers/ha-dialog-fixture.mjs';

const fixture = await launchHaDialogFixture({ extraModules: ['16213'] });
const { page } = fixture;
const failures = [];
const equal = (actual, expected, message) => { if (actual !== expected) failures.push({ actual, expected, message }); };
mkdirSync('artifacts/field-focus-870', { recursive: true });
try {
  await page.goto(`${fixture.url}/ha505-probe.html`);
  await page.waitForFunction(() => customElements.get('ha-icon-picker') && document.querySelector('ha-dialog'));
  await page.evaluate((css) => {
    const style = document.createElement('style'); style.textContent = css;
    document.head.append(style);
    document.querySelector('ha-dialog').remove();
    const dialog = document.createElement('main'); document.body.append(dialog);
    dialog.style.cssText = 'margin:40px auto;width:460px;background:var(--card-background-color);padding:20px';
    dialog.innerHTML = `<hp-dialog><div class="hpf-form" style="--hpf-accent:#f0a000;--hpf-line:#999;--hpf-canvas:transparent;padding:20px">
      <input id="plain" class="hpf-input" value="ordinary">
      <select id="select" class="hpf-select"><option>A</option><option>B</option></select>
      <div class="hpf-unit"><input id="radius" value="3"><span>m</span></div>
      <div class="hpf-iconfield-control"><input id="fallback" class="hpf-input" value="mdi:lightbulb"></div>
      <div id="authentic-wrapper" class="hpf-iconfield-control"><ha-icon-picker></ha-icon-picker></div>
      <button id="button">Save</button><input id="disabled" class="hpf-input" disabled>
    </div></hp-dialog>`;
    const picker = dialog.querySelector('ha-icon-picker'); picker.value = 'mdi:lightbulb';
    window.__focusChanges = [];
    picker.addEventListener('value-changed', e => window.__focusChanges.push(e.detail.value));
  }, formKitCss(CARD_DIALOG_FORM_KIT));
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => {
      Object.assign(document.documentElement.style, { colorScheme: theme });
      for (const [key, value] of Object.entries({ '--primary-color':'#f0a000', '--primary-text-color':theme==='dark'?'#eee':'#222', '--card-background-color':theme==='dark'?'#242424':'#fff' })) document.documentElement.style.setProperty(key,value);
    }, theme);
    for (const method of ['mouse', 'keyboard']) {
      for (const id of ['plain', 'select', 'radius', 'fallback', 'button']) {
        const input = page.locator(`#${id}`);
        if (method === 'mouse') await input.click();
        else { await input.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); }
        const state = await input.evaluate(input => {
          const width = el => { const s=getComputedStyle(el); return s.outlineStyle==='none'?'0px':s.outlineWidth; };
          return { inner:width(input), outer:width(input.parentElement), active:input.matches(':focus'), visible:input.matches(':focus-visible'), border:getComputedStyle(input).borderColor };
        });
        equal(state.active, true, `${id} receives ${method} focus`);
        if (['radius','fallback'].includes(id)) {
          equal(state.inner, '0px', `${id}: no inner focus ring`);
          equal(state.outer, '2px', `${id}: wrapper owns focus`);
        } else if (id==='button' && method==='keyboard' && state.visible) equal(state.inner, '2px', `${id}: keyboard focus stays visible`);
        else if (id!=='button') equal(state.border, 'rgb(240, 160, 0)', `${id}: active border stays visible`);
      }
      const pickerInput = page.locator('ha-icon-picker ha-picker-field button#item').first();
      await pickerInput.waitFor();
      if (method==='mouse') { await pickerInput.click(); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await pickerInput.focus(); }
      else { await pickerInput.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); }
      await page.waitForTimeout(250);
      const png = await page.screenshot({ path:`artifacts/field-focus-870/${theme}-${method}.png` });
      const state = await page.locator('#authentic-wrapper').evaluate(wrapper => {
        const all=[]; const visit=root=>{ for(const el of root.querySelectorAll('*')) { all.push(el); if(el.shadowRoot) visit(el.shadowRoot); } }; visit(wrapper);
        return { outer: getComputedStyle(wrapper).outlineStyle==='none'?'0px':getComputedStyle(wrapper).outlineWidth, focused: all.some(el=>el.matches(':focus')),
          box:(()=>{const r=wrapper.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})() };
      });
      // Raster oracle: exactly one long accent band (the genuine HA underline),
      // not the old outer top/bottom ring and not zero focus paint.
      const bands = await page.evaluate(async ({base64,box}) => {
        const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
        const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
        const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
        const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
        let groups=0,previous=false;
        for(let y=Math.floor(box.y)-4;y<Math.ceil(box.y+box.height)+4;y++) {
          let count=0;for(let x=Math.ceil(box.x)+8;x<Math.floor(box.x+box.width)-8;x++) {
            const at=(y*canvas.width+x)*4;
            if(Math.abs(data[at]-240)<8 && Math.abs(data[at+1]-160)<8 && data[at+2]<8) count++;
          }
          const painted=count>box.width*.65;if(painted&&!previous)groups++;previous=painted;
        }
        return groups;
      },{base64:png.toString('base64'),box:state.box});
      console.log(theme, method, JSON.stringify(state));
      equal(state.outer, '0px', 'authentic picker owns its focus, wrapper must not add another ring');
      equal(state.focused, true, 'real picker input is focused');
      equal(bands, 1, 'authentic picker paints exactly one focus band');
    }
  }
  // Genuine picker custom-value path remains available; no replacement event handler.
  await page.locator('ha-icon-picker ha-picker-field button#item').first().click();
  const pickerInput = page.locator('ha-icon-picker input').first();
  await pickerInput.fill('mdi:fan'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__focusChanges.includes('mdi:fan'));
  assert.equal(await page.locator('#disabled').isDisabled(), true);
  assert.deepEqual(failures, [], 'each field has a single visible focus owner');
  await fixture.assertClean();
  console.log('OK #870 native + authentic focus', JSON.stringify(fixture.provenance));
} finally { await fixture.close(); }
