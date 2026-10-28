/** #1098 native stairs/LED pointer and commit counters; no timing budget. */
import {launch,reportPageErrors} from './serve.mjs';
import {makeLargeHouseFixture} from './fixtures/large-house.mjs';
import {writeFileSync} from 'node:fs';
const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const samples=Number(arg('samples')||7), baseline=process.argv.includes('--baseline');
const fixture=makeLargeHouseFixture();
fixture.config.spaces[0].stairs=[...fixture.config.spaces[0].stairs.slice(1),{id:'gesture-stair',kind:'straight',x:.5,y:.5,angle:0,direction:'forward',length:.05,width:.03}];
fixture.config.spaces[0].led_strips=[{id:'gesture-led',points:[[.42,.42],[.44,.42],[.46,.42]],marker:null}];
const rows=[];
for(const dpr of [1,2]){
 const {page,browser}=await launch({width:1440,height:1000},dpr);
 try{
  await page.evaluate(async fixture=>{
   const c=window.__card,hp=window.__hpTest;
   c.hass={...c.hass,devices:fixture.devices,entities:fixture.entities,areas:fixture.areas,states:fixture.states};
   await hp.setServerConfig(fixture.config);await hp.setLayout(fixture.layout);
  },fixture);
  for(let sample=0;sample<samples;sample++){
   await page.evaluate(async fixture=>{await window.__hpTest.setMode('view');await window.__hpTest.setServerConfig(fixture.config);},fixture);
   const row=await page.evaluate(async({sample,dpr})=>{
    const c=window.__card,hp=window.__hpTest,root=()=>c.renderRoot;
    const frame=()=>new Promise(r=>requestAnimationFrame(r));
    const idle=async()=>{const until=performance.now()+6000;while((c._saveConfigDebounced.pending()||c._writesPending>0)&&performance.now()<until)await new Promise(r=>setTimeout(r,16));await hp.settled();};
    let renders=0,syncs=0;const body=c._renderBody,contacts=c._deviceContacts,sync=contacts.sync;
    c._renderBody=function(...args){renders++;return body.apply(this,args);};contacts.sync=function(...args){syncs++;return sync.apply(this,args);};
    const snap=()=>({...c._floorCacheBuilds,renders,syncs,epoch:c._cfgEpoch,live:c._liveEditorPaintCount});
    const delta=(a,b)=>Object.fromEntries(Object.keys(a).map(k=>[k,b[k]-a[k]]));
    const pointer=(target,type,p,pid)=>{const q=new DOMPoint(...p).matrixTransform(root().querySelector('.plan-svg').getScreenCTM());target.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,cancelable:true,pointerId:pid,pointerType:'mouse',isPrimary:true,button:type==='pointerdown'?0:-1,clientX:q.x,clientY:q.y}));};
    const result={sample,dpr};
    try{
     await hp.setMode('plan');await hp.setTool('select');await hp.settled();
     let stair=root().querySelector('[data-hp="stair"][data-id="gesture-stair"] .hp-stair-hit');
     if(!stair)throw new Error('stair fixture missing');
     const raw=c._serverCfg.spaces[0].stairs[0],from=[raw.x*1000,raw.y*1000],pid=700+sample;
     pointer(stair,'pointerdown',from,pid);await hp.settled();
     const before=snap(),started=performance.now();
     for(let i=1;i<=30;i++){pointer(stair,'pointermove',[from[0]+i*.1,from[1]+i*.1],pid);await frame();}
     await frame();result.stairsMoveMs=performance.now()-started;result.stairsMoves=delta(before,snap());
     result.unrelatedStairPreserved=c._serverCfg.spaces[0].stairs[0].x===raw.x;
     const commit=snap(),commitStart=performance.now();pointer(stair,'pointerup',[from[0]+3,from[1]+3],pid);await idle();
     result.stairsCommitMs=performance.now()-commitStart;result.stairsCommit=delta(commit,snap());
     await hp.setMode('devices');
     const select=root().querySelector('[data-led-select="gesture-led"]');if(!select)throw new Error('LED selection missing');
     select.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));await hp.settled();
     const handle=root().querySelector('[data-led-handle="1"]');if(!handle)throw new Error('LED handle missing');
     const p=[Number(handle.getAttribute('cx')),Number(handle.getAttribute('cy'))];
     const screen=new DOMPoint(...p).matrixTransform(root().querySelector('.plan-svg').getScreenCTM());
     window.__gestureProbe={snap,delta,idle,frame,body,contacts,sync,p,result,getRenders:()=>renders};
     return {result,screen:[screen.x,screen.y]};
    }catch(error){c._renderBody=body;contacts.sync=sync;throw error;}
   },{sample,dpr});
   await page.mouse.move(...row.screen);await page.mouse.down();
   const result=await page.evaluate(async()=>{
    const {snap,delta,idle,frame,p,result}=window.__gestureProbe,c=window.__card;
    const handle=c.renderRoot.querySelector('[data-led-handle="1"]'),lb=snap(),ls=performance.now();
    for(let i=1;i<=30;i++){
     const q=new DOMPoint(p[0],p[1]+i).matrixTransform(c.renderRoot.querySelector('.plan-svg').getScreenCTM());
     handle.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true,pointerId:1,pointerType:'mouse',isPrimary:true,button:-1,clientX:q.x,clientY:q.y}));await frame();
    }
    await frame();result.ledMoveMs=performance.now()-ls;result.ledMoves=delta(lb,snap());
    window.__gestureProbe.commit=snap();window.__gestureProbe.commitStart=performance.now();return result;
   });
   await page.mouse.up();
   await page.evaluate(async()=>{const p=window.__gestureProbe;await p.idle();p.result.ledCommitMs=performance.now()-p.commitStart;p.result.ledCommit=p.delta(p.commit,p.snap());window.__card._renderBody=p.body;p.contacts.sync=p.sync;});
   const final=await page.evaluate(()=>window.__gestureProbe.result);
   rows.push(final);console.log(JSON.stringify(final));
  }
  if(await reportPageErrors())throw new Error('page errors');
 }finally{await browser.close();}
}
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const summary=[1,2].map(dpr=>({dpr,...Object.fromEntries(['stairsMoveMs','stairsCommitMs','ledMoveMs','ledCommitMs'].map(k=>[k,median(rows.filter(r=>r.dpr===dpr).map(r=>r[k]))]))}));
const failures=[];
for(const row of rows){for(const name of ['stairsMoves','ledMoves','stairsCommit','ledCommit'])for(const key of ['wallUnion','physicalBodies','innerContour','lightBarrier'])if(row[name][key]!==0)failures.push(`${row.dpr}/${row.sample}/${name}/${key}=${row[name][key]}`);
 for(const name of ['stairsMoves','ledMoves'])if(row[name].syncs!==0||row[name].epoch!==0||row[name].renders!==0)failures.push(`${row.dpr}/${row.sample}/${name} full/epoch/contacts`);
}
const report={issue:1098,fixture:'large-house-v1',samples,rows,summary,failures,baseline};
if(arg('output'))writeFileSync(arg('output'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary,failures},null,2));if(failures.length&&!baseline)process.exitCode=1;