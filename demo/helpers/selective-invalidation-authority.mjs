// #1093 AC8: trusted Save across retired dialog, HA authority and route owners.
import assert from 'node:assert/strict';

export async function runSaveAuthorityWitnesses({createScene,scenarios=['space-reopen','room-connection','room-user','general-route-refused','general-route-lost']}) {
  const results=[];
  for(const scenario of scenarios) {
    const scene=await createScene(scenario),{page,card}=scene;
    const kind=scenario.startsWith('space')?'space':scenario.startsWith('room')?'room':'settings';
    const tick=()=>page.evaluate(async()=>{await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    const row={scenario,kind};results.push(row);
    try {
      await page.evaluate(({scenario,kind})=>{
        window.__save1093=undefined;
        const c=window.__card,original=c.hass.callWS.bind(c.hass);
        const p={scenario,kind,original,requests:[],trusted:0,before:null,release:null,done:false,path:location.pathname+location.search};
        window.__authority1093=p;
        c.addEventListener('pointerdown',event=>{
          if(event.isTrusted&&event.composedPath().some(n=>n?.getAttribute?.('data-hp')==='dialog-confirm'))p.trusted++;
        },true);
        c.hass={...c.hass,callWS:async message=>{
          if(message.type!=='houseplan/config/set')return original(message);
          p.requests.push(structuredClone(message));
          await new Promise(resolve=>p.release=resolve);
          try {
            if(scenario.endsWith('refused'))throw Object.assign(new Error('controlled refusal'),{code:'forbidden'});
            const response=await original(message);p.accepted=structuredClone(response);
            if(scenario.endsWith('lost'))throw new Error('controlled lost response after acceptance');
            return response;
          } finally {p.done=true;}
        }};
      },{scenario,kind});
      row.before=await page.evaluate(async()=>{
        const p=window.__authority1093;
        p.before=structuredClone(await p.original({type:'houseplan/config/get'}));
        p.layout=structuredClone(await p.original({type:'houseplan/layout/get'}));
        return p.before;
      });
      if(kind==='space')await card.locator('[data-hp="space-settings"][data-id="f1"]').click();
      else if(kind==='room') {
        await page.evaluate(()=>window.__hpTest.setMode('plan'));
        await card.locator('[data-hp="room-settings"][data-room="f1-r0"]').click();
      } else await card.locator('[data-hp="settings"]').click();
      const dialog=card.locator(`hp-dialog[data-kind="${kind}"]`);
      const expected=`Native authority ${scenario}`;
      if(kind==='space')await dialog.locator('#space-title').fill(expected);
      else if(kind==='room')await dialog.locator('#room-name').fill(expected);
      else {
        await dialog.locator('[data-section-target="plan"]').click();
        const select=dialog.locator('select[name="gs-bg-mode"]');
        row.expected=await select.inputValue()==='static'?'daynight':'static';
        await select.selectOption(row.expected);
      }
      await dialog.locator('[data-hp="dialog-confirm"]').click();
      await page.waitForFunction(()=>typeof window.__authority1093.release==='function');
      assert.equal(await dialog.isVisible(),true,`${scenario}: held Save stays open`);
      assert.equal(await dialog.locator('[data-hp="dialog-confirm"]').isDisabled(),true);
      assert.equal(await page.evaluate(()=>window.__authority1093.trusted),1,'trusted native Save');
      assert.deepEqual(await page.evaluate(()=>window.__authority1093.original({type:'houseplan/config/get'})),row.before,'held request has not reached fixture store');
      if(kind==='space') {
        await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
        await card.locator('[data-hp="space-settings"][data-id="f1"]').click();
        await dialog.locator('#space-title').fill('New independent draft');
      } else if(kind==='room') {
        await page.keyboard.press('Escape');
        await card.locator('hp-confirm [data-hp="dialog-confirm"]').click();
        await dialog.waitFor({state:'hidden'});
        await page.evaluate(scenario=>{
          const c=window.__card,p=window.__authority1093,foreign=structuredClone(p.before.config);
          foreign.spaces[0].title='Foreign owner';foreign.spaces[0].rooms[0].name='Foreign room';
          p.foreign=foreign;p.foreignWrites=0;
          c.hass={...c.hass,
            ...(scenario==='room-connection'?{connection:{...c.hass.connection}}:{user:{...c.hass.user,id:'foreign-user-1093'}}),
            callWS:async message=>{
              if(message.type==='houseplan/config/get')return {config:structuredClone(foreign),rev:701,can_write:true};
              if(message.type==='houseplan/layout/get')return {...structuredClone(p.layout),rev:702};
              if(message.type==='houseplan/config/set'){p.foreignWrites++;throw new Error('unexpected foreign write');}
              return p.original(message);
            }};
        },scenario);
        await page.waitForFunction(()=>window.__card._loadOk&&window.__card._serverCfg?.spaces[0].title==='Foreign owner');
        await card.locator('[data-hp="room-settings"][data-room="f1-r0"]').click();
        assert.equal(await dialog.locator('#room-name').inputValue(),'Foreign room');
        await dialog.locator('#room-name').fill('New foreign draft');
      } else {
        await page.evaluate(()=>{
          history.pushState(null,'','/authority-away-1093');
          window.dispatchEvent(new CustomEvent('location-changed',{detail:{replace:false}}));
        });
      }
      await page.evaluate(()=>window.__authority1093.release());
      await page.waitForFunction(()=>window.__authority1093.done&&window.__card._writesPending===0);
      await tick();
      row.persisted=await page.evaluate(()=>window.__authority1093.original({type:'houseplan/config/get'}));
      if(kind==='space') {
        assert.equal(row.persisted.config.spaces[0].title,expected);
        assert.equal(await dialog.isVisible(),true,'late ACK cannot close replacement dialog');
        assert.equal(await dialog.locator('#space-title').inputValue(),'New independent draft');
        assert.equal(await dialog.locator('[data-hp="dialog-confirm"]').isEnabled(),true);
      } else if(kind==='room') {
        assert.equal(row.persisted.config.spaces[0].rooms[0].name,expected,'old server accepted its own request');
        const current=await page.evaluate(()=>({config:structuredClone(window.__card._serverCfg),rev:window.__card._cfgRev,
          foreignWrites:window.__authority1093.foreignWrites,room:!!window.__card._roomDialog,name:window.__card._nameSel}));
        assert.equal(current.config.spaces[0].title,'Foreign owner');
        assert.equal(current.config.spaces[0].rooms[0].name,'Foreign room');
        assert.equal(current.rev,701);assert.equal(current.foreignWrites,0);
        row.current=current;
        assert.equal(await dialog.isVisible(),true,'late old ACK preserves current foreign Room');
        assert.equal(await dialog.locator('#room-name').inputValue(),'New foreign draft');
        assert.equal(await dialog.locator('[data-hp="dialog-confirm"]').isEnabled(),true);
      } else {
        if(scenario.endsWith('refused'))assert.deepEqual(row.persisted,row.before,'refusal preserves actual store');
        else assert.equal(row.persisted.config.settings.bg_mode,row.expected,'lost reply may persist without accepted UI');
        assert.equal(await page.evaluate(()=>window.__card._settingsDialog===null),true,'route retires form');
        row.successNotice=await page.evaluate(()=>{const c=window.__card,text=c._t('gs.saved');return {text,current:c._toast,rendered:[...c.renderRoot.querySelectorAll('[data-hp="toast"]')].map(n=>n.textContent.trim())};});
        assert.ok(row.successNotice.text,'translated success sentinel exists');
        assert.notEqual(row.successNotice.current,row.successNotice.text,'no false success toast');
        assert.equal(row.successNotice.rendered.includes(row.successNotice.text),false,'no accepted DOM notice');
        await page.evaluate(()=>{
          history.pushState(null,'',window.__authority1093.path);
          window.dispatchEvent(new CustomEvent('location-changed',{detail:{replace:false}}));
        });
        await tick();await dialog.waitFor({state:'hidden',timeout:2000});assert.equal(await dialog.isVisible(),false,'return cannot resurrect retired form');
      }
      row.requests=await page.evaluate(()=>window.__authority1093.requests.length);
      assert.equal(row.requests,1,'no duplicate config write');row.pass=true;
    } catch(error) {
      row.error=error.stack||String(error);
      row.diagnostic=await page.evaluate(()=>({requests:window.__authority1093?.requests,pending:window.__card?._writesPending,
        accepted:window.__authority1093?.accepted,toast:window.__card?._toast,
        forms:[...window.__card.renderRoot.querySelectorAll('hp-dialog')].map(n=>({kind:n.dataset.kind,text:n.textContent.slice(0,400)}))})).catch(()=>null);
      error.authorityWitnesses=results;throw error;
    } finally {await scene.close();}
  }
  return results;
}
