import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';

/** #1253: native mouse hover, click, cancellation and full-host reconciliation. */
export async function stairsPlacementPreview(page){
  const root=page.locator('houseplan-card');
  const settle=()=>page.evaluate(()=>window.__hpTest.settled());
  const arm=async kind=>{
    await root.locator('[data-hp="tool"][data-tool="stairs"]').click();
    await root.locator(`[data-hp="tray"] [data-group-item="${kind}"]`).click();
    await settle();
  };
  const observe=()=>page.evaluate(()=>{
    const c=window.__card;
    const visible=element=>{
      for(let node=element;node instanceof Element;node=node.parentElement){
        const s=getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;
      }return true;
    };
    const previews=[...c.renderRoot.querySelectorAll('.hp-stair-placement-preview')].filter(visible);
    const signature=node=>node&&({kind:node.dataset.kind,
      shape:node.querySelector('.hp-stair-outline')?.getAttribute('points'),
      treads:node.querySelector('.hp-stair-tread')?.getAttribute('d'),
      arrow:node.querySelector('.hp-stair-arrow')?.getAttribute('d'),style:node.getAttribute('style')});
    const stairs=c._curSpaceCfg.stairs||[];
    return{previews:previews.length,preview:signature(previews[0]?.querySelector('[data-hp="stair"]')),
      last:signature([...c.renderRoot.querySelectorAll('.hp-stairs-layer > [data-hp="stair"]')].filter(visible).at(-1)),
      cfg:JSON.stringify(c._serverCfg),epoch:c._cfgEpoch,rev:c._cfgRev,layoutRev:c._layoutRev,count:stairs.length,
      saved:stairs.at(-1),pending:c._saveConfigDebounced.pending()||c._writesPending>0};
  });
  await page.evaluate(async()=>{
    await window.__hpTest.waitForWrites();
    await window.__hpTest.setTool('select');
    await window.__hpTest.setServerConfig(cfg=>{
      const space=cfg.spaces.find(s=>s.id===window.__card._space);delete space.stairs;
    });
  });
  const evidence=[];
  for(const kind of ['straight','spiral']){
    await arm(kind);
    const base=await observe();
    const b=await root.locator('.stage').boundingBox();assert.ok(b);
    const at={x:b.x+b.width*(kind==='straight'?.61:.38),y:b.y+b.height*(kind==='straight'?.61:.35)};
    for(let i=0;i<12;i++)await page.mouse.move(at.x+i,at.y);
    await settle();
    const hovered=await observe();assert.equal(hovered.previews,1);assert.equal(hovered.preview.kind,kind);
    for(const key of ['cfg','epoch','rev','layoutRev','count'])assert.equal(hovered[key],base[key],`hover preserves ${key}`);
    assert.equal(hovered.pending,false);
    // A real HA property update forces the host to reconcile during hover.
    await page.evaluate(async()=>{
      const c=window.__card;c.hass={...c.hass,states:{...c.hass.states}};
      await c.updateComplete;await window.__hpTest.settled();
    });
    const reconciled=await observe();assert.equal(reconciled.previews,1);
    assert.deepEqual(reconciled.preview,hovered.preview,'one live owner after a host render');
    await page.mouse.click(at.x+11,at.y);
    await page.evaluate(()=>window.__hpTest.waitForWrites());await settle();
    const placed=await observe();assert.equal(placed.count,base.count+1);assert.equal(placed.previews,0);
    assert.equal(placed.last.kind,hovered.preview.kind);assert.equal(placed.last.style,hovered.preview.style);
    // Storage rounds normalized scalars to nine decimals. Compare SVG geometry
    // at that existing precision, without changing dimensions or visual pixels.
    for(const key of ['shape','treads','arrow']){
      const pattern=/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi;
      const before=hovered.preview[key]||'',after=placed.last[key]||'';
      assert.equal(after.replace(pattern,'#'),before.replace(pattern,'#'));
      const a=(after.match(pattern)||[]).map(Number),b=(before.match(pattern)||[]).map(Number);
      assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<.000002,`saved ${key} matches preview`);
    }
    // Leaving the plan removes just the transient; a new move can rearm it.
    await page.mouse.move(at.x+70,at.y+30);await settle();assert.equal((await observe()).previews,1);
    await page.mouse.move(b.x+10,b.y-20);await settle();assert.equal((await observe()).previews,0);
    const cancelAt={x:b.x+b.width*.8,y:b.y+b.height*(kind==='straight'?.25:.78)};
    await page.mouse.move(cancelAt.x,cancelAt.y);await settle();
    const beforeCancel=await observe();assert.equal(beforeCancel.previews,1);
    await page.mouse.down();await page.mouse.move(cancelAt.x+40,cancelAt.y+35);await page.keyboard.press('Escape');await page.mouse.up();
    await settle();const cancelled=await observe();assert.equal(cancelled.previews,0);
    for(const key of ['cfg','epoch','rev','layoutRev','count'])assert.equal(cancelled[key],beforeCancel[key],`cancel preserves ${key}`);
    evidence.push({kind,hovered,reconciled,placed,cancelled});
  }
  await root.locator('[data-hp="tool"][data-tool="select"]').click();await settle();
  assert.equal((await observe()).previews,0);
  mkdirSync('artifacts/stairs-placement-preview',{recursive:true});
  writeFileSync('artifacts/stairs-placement-preview/evidence.json',JSON.stringify(evidence,null,2));
  return{stairs1253NativeHoverAndClick:true,stairs1253NoHoverWrites:true,
    stairs1253SingleOwnerAfterHostRender:true,stairs1253LeaveAndEscapeTail:true};
}