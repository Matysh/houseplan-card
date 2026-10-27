// #1093 A: native Save -> one real config write -> accepted, closed, correct DOM.
import assert from 'node:assert/strict';

export async function runPaintTiming({page,card,delay,iterations,cases,onSample=()=>{}}) {
  const samples=[];
  await page.evaluate(()=>{window.__save1093=undefined;});
  await page.evaluate(()=>{
    const c=window.__card,original=c.hass.callWS;
    const counters=()=>({floor:{...c._floorCacheBuilds},contacts:{...c._deviceContacts.work},
      live:c._liveRt.work(),models:c._spaceModels.work.builds});
    const state={sample:null,original,frame:0};window.__paintTiming1093=state;
    const matches=p=>{
      const space=c._serverCfg.spaces.find(s=>s.id===p.space);
      const root=c.renderRoot,stage=root.querySelector('.stage');
      if(root.querySelector(`hp-dialog[data-kind="${p.kind}"]`))return false;
      if(p.case==='visible-bg')return space.settings?.bg_mode===p.expected
        &&stage.classList.contains('daycycle')===(p.expected==='daynight');
      if(p.case==='visible-color')return space.settings?.bg_color===p.expected
        &&getComputedStyle(stage).backgroundColor===p.rgb;
      if(p.case==='room-name')return space.rooms[0].name===p.expected
        &&root.querySelector(`[data-hp="room-label"][data-id="${space.rooms[0].id}"] .rlfit`)?.textContent===p.expected;
      if(p.case==='room-paint')return (space.rooms[0].settings?.name_scale??1)===p.expected
        &&Number(root.querySelector(`[data-hp="room-label"][data-id="${space.rooms[0].id}"]`)?.style.getPropertyValue('--rl-name'))===p.expected;
      const title=root.querySelector(`[data-hp="space-tab"][data-id="${p.space}"] .tabtitle`)
        ||root.querySelector(`[data-hp="space-select-value"] option[value="${p.space}"]`);
      return space.title===p.expected&&c._space==='f1'&&title?.textContent===p.expected;
    };
    state.onInput=event=>{
      const p=state.sample;
      if(!p||p.input!==undefined||!event.isTrusted||!event.composedPath().some(n=>n?.getAttribute?.('data-hp')==='dialog-confirm'))return;
      p.input=performance.now();p.trusted=true;p.before=counters();
      const observe=()=>{
        if(state.sample!==p)return;
        if(p.ack!==undefined&&matches(p)) {p.paint=performance.now();p.after=counters();return;}
        state.frame=requestAnimationFrame(observe);
      };
      state.frame=requestAnimationFrame(observe);
    };
    c.addEventListener('pointerdown',state.onInput,true);
    state.wrapped=async message=>{
      const p=state.sample;
      if(message.type!=='houseplan/config/set'||p?.input===undefined)return original(message);
      p.requests++;p.request=performance.now();
      if(p.delay)await new Promise(r=>setTimeout(r,p.delay));
      const response=await original(message);p.ack=performance.now();return response;
    };
    c.hass={...c.hass,callWS:state.wrapped};
  });
  try {
    for(const name of cases) {
      const room=name.startsWith('room-'),space=name==='inactive-paint'?'f2':'f1';
      await page.evaluate(async room=>{await window.__hpTest.setMode(room?'plan':'view');await window.__card.updateComplete;},room);
      await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._modeTransitionPreparing);
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      for(let iteration=0;iteration<iterations;iteration++) {
        if(room)await card.locator('[data-hp="room-settings"][data-room="f1-r0"]').click();
        else {
          const gear=card.locator(`[data-hp="space-settings"][data-id="${space}"]`);
          if(space==='f2'&&!await gear.count())throw Error(`Inactive native settings unavailable: ${JSON.stringify(await page.evaluate(()=>({
            compact:window.__card._compactSpaces,mode:window.__card._mode,host:document.querySelector('#host').getBoundingClientRect().width,
            card:window.__card.getBoundingClientRect().width,header:window.__card.renderRoot.querySelector('.hdr').getBoundingClientRect().width,
            tabs:window.__card.renderRoot.querySelector('.tabs').outerHTML
          })))}`);
          await gear.click();
        }
        const kind=room?'room':'space',dialog=card.locator(`hp-dialog[data-kind="${kind}"]`);
        let expected,rgb;
        if(name==='visible-bg'||name==='visible-color') {
          await dialog.locator('[data-section-target="sun"]').click();
          expected=await page.evaluate(()=>window.__card._serverCfg.spaces[0].settings?.bg_mode==='daynight'?'static':'daynight');
          await dialog.locator('select[name="space-bg-mode"]').selectOption(name==='visible-color'?'static':expected);
          if(name==='visible-color') {
            expected=await page.evaluate(()=>window.__card._serverCfg.spaces[0].settings?.bg_color==='#456789'?'#123456':'#456789');
            rgb=expected==='#123456'?'rgb(18, 52, 86)':'rgb(69, 103, 137)';
            const picker=dialog.locator('hp-color-opacity[data-field="space-bg-color"]');
            await picker.locator('[data-field="colour-open"]').click();
            await picker.locator('[data-field="colour-hex"]').fill(expected);
            await picker.locator('[data-field="colour-hex"]').press('Enter');
            await page.keyboard.press('Escape');
          }
        } else if(name==='room-paint') {
          expected=await page.evaluate(()=>window.__card._serverCfg.spaces[0].rooms[0].settings?.name_scale===1.2?1:1.2);
          await dialog.locator('#room-name-scale').fill(String(expected*100));
          await dialog.locator('#room-name-scale').press('Tab');
        } else {
          expected=`${room?'R':space==='f1'?'A':'B'}${delay}-${iteration}`;
          if(!room)await dialog.locator('[data-section-target="basics"]').click();
          await dialog.locator(room?'#room-name':'#space-title').fill(expected);
        }
        await page.evaluate(sample=>{window.__paintTiming1093.sample=sample;},{case:name,kind,space,expected,rgb,iteration,delay,requests:0});
        await dialog.locator('[data-hp="dialog-confirm"]').click();
        try {await page.waitForFunction(()=>window.__paintTiming1093.sample.paint!==undefined,null,{timeout:15000});}
        catch(error) {throw new Error(`No accepted painted ${name}: ${JSON.stringify(await page.evaluate(()=>window.__paintTiming1093.sample))}`,{cause:error});}
        const sample=await page.evaluate(()=>{
          const p=window.__paintTiming1093.sample;window.__paintTiming1093.sample=null;
          return {...p,inputToRequest:p.request-p.input,ackToPaint:p.paint-p.ack,client:p.paint-p.input-p.delay,
            longTasks:window.__long1093.filter(t=>t.start<p.paint&&t.start+t.duration>p.input)};
        });
        const persisted=await page.evaluate(async space=>(await window.__card.hass.callWS({type:'houseplan/config/get'})).config.spaces.find(s=>s.id===space),space);
        assert.equal(name==='visible-bg'?persisted.settings.bg_mode:name==='visible-color'?persisted.settings.bg_color:
          name==='room-name'?persisted.rooms[0].name:name==='room-paint'?(persisted.rooms[0].settings?.name_scale??1):persisted.title,expected);
        assert.equal(sample.requests,1);assert.equal(sample.trusted,true);sample.persisted=true;
        for(const key of ['wallUnion','physicalBodies','cleanFloor','openingWallIndex'])
          assert.equal(sample.after.floor[key],sample.before.floor[key],`${name}: ${key}`);
        assert.equal(sample.after.contacts.rebuilds,sample.before.contacts.rebuilds,`${name}: contacts`);
        assert.equal(sample.after.models,sample.before.models,`${name}: scaled floor models`);
        samples.push(sample);onSample(sample);
      }
    }
    return samples;
  } finally {
    await page.evaluate(()=>{
      const c=window.__card,s=window.__paintTiming1093;cancelAnimationFrame(s.frame);
      c.removeEventListener('pointerdown',s.onInput,true);
      if(c.hass.callWS===s.wrapped)c.hass={...c.hass,callWS:s.original};delete window.__paintTiming1093;
    });
  }
}
