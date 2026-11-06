import{readFileSync,writeFileSync}from'node:fs';import{launch}from'../../demo/serve.mjs';
const dir='artifacts/corner-20261106',x={payload:{config:JSON.parse(readFileSync(dir+'/minimal-config.json'))}};const s=x.payload.config.spaces[0];
const fixture={model_version:11,spaces:[{...s,title:'Corner diagnostic',settings:{...s.settings,bg_mode:'static',bg_color:'#1c2430',show_names:false},rooms:s.rooms.map(r=>({id:r.id,name:'',poly:r.poly,wall_ids:r.wall_ids})),decor:[],stairs:[],openings:[]}],markers:[],settings:{bg_color:'#1c2430'}};
const{page,browser}=await launch({width:1500,height:1250},1);
try{const report=await page.evaluate(async cfg=>{const c=window.__card;c._serverCfg=cfg;c._layout={};c._space=cfg.spaces[0].id;c._cfgEpoch++;c._modelCache=null;c._frame=null;c._wallUnionCache=null;c._setMode('view');c.requestUpdate();await c.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const vb=c._baseVb();const fit=c._fitView?c._fitView(vb):null;c._applyView(2.65,2250,-850);c.requestUpdate();await c.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return{vb,view:c._view,gridPitch:c._gridPitch,cellCm:c._cellCm,space:c._space,graphUnchanged:JSON.stringify(c._serverCfg.spaces[0].plan_graph)===JSON.stringify(cfg.spaces[0].plan_graph)};},fixture);writeFileSync(dir+'/card-report.json',JSON.stringify(report,null,2));await page.screenshot({path:dir+'/card.png'});console.log(report);}finally{await browser.close();}



