// #1038 CODE r1: actual selected Text geometry work, public HA/input and persisted config.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser();
const {page,browser}=await launch({width:1600,height:1100});
const card=page.locator('houseplan-card');
const settle=()=>page.evaluate(async()=>{
  await window.__hpTest.waitForWrites();await window.__card.updateComplete;
  await window.__card._editorRuntime._whenLiveEditorSettled();
});
const state=()=>page.evaluate(()=>({
  ids:[...window.__card._editorRuntime.properties.decorSelectionIds],native:window.__card._decorSel,
  decor:structuredClone(window.__card._decorList),history:window.__card._geometryHistory.size,
  writes:window.__1038Writes.length,tool:window.__card._decorTool,
}));
const rect=(id,x,y,color='#ff0000',opacity=.2)=>({id,kind:'rect',x,y,w:.13,h:.09,fill:true,fill_color:'#778899',fill_opacity:.6,color,opacity,angle:0,width_cm:2,future:{keep:[id,true]}});
const records=()=>[
  {id:'line',kind:'line',x1:.12,y1:.16,x2:.32,y2:.23,color:'#ff0000',opacity:.2,line_style:'dashed',width_cm:3},
  rect('rect',.4,.15),{...rect('ellipse',.66,.16),kind:'ellipse',angle:24},
  {id:'text',kind:'text',x:.2,y:.48,text:'Room {sensor.group_temperature}',color:'#334455',size_cm:16,angle:17},
  {id:'furniture',kind:'furniture',x:.4,y:.4,w:.18,h:.13,symbol:'sofa',color:'#116633',opacity:.7,angle:22,flip_h:true},
  {id:'image',kind:'image',x:.67,y:.4,w:.16,h:.12,asset_id:'a'.repeat(64),opacity:.6,angle:-15,flip_v:true},
];
const seed=async decor=>{
  await page.evaluate(async decor=>{
    await window.__hpTest.waitForWrites();
    await window.__hpTest.setServerConfig(cfg=>({...cfg,spaces:[
      {id:'group',title:'Group',cell_cm:5,view_box:[0,0,1,1],rooms:[],wall_segments:[],decor},
      {id:'other',title:'Other',cell_cm:5,view_box:[0,0,1,1],rooms:[],decor:[{id:'foreign',kind:'text',x:.3,y:.3,text:'Other floor'}]},
    ],markers:[]}));
    if(window.__card._space!=='group')window.__card.renderRoot.querySelector('[data-hp="space-tab"][data-id="group"]').click();
    await window.__hpTest.setMode('decor');await window.__hpTest.setTool('select');
  },decor);
  await card.locator('[data-hp="zoom-fit"]').click();await settle();
};
const point=async(x,y)=>card.locator('.decorlayer').evaluate((el,[x,y])=>{
  const p=new DOMPoint(x*1000,y*1000).matrixTransform(el.getScreenCTM());return{x:p.x,y:p.y};
},[x,y]);
// Search only the actual painted public hit surface, excluding occluded/offscreen points.
const hit=async id=>card.evaluate((c,id)=>{
  const shapes=[...c.renderRoot.querySelectorAll('[data-hp="decor"][data-id]')].filter(el=>el.dataset.id===id);
  for(const shape of shapes){const b=shape.getBoundingClientRect();
    for(const fy of [.5,.1,.9,.25,.75,0,1])for(const fx of [.5,.1,.9,.25,.75,0,1]){
      const x=b.x+b.width*fx,y=b.y+b.height*fy;if(x<0||y<0||x>innerWidth||y>innerHeight)continue;
      const actual=c.renderRoot.elementFromPoint(x,y)?.closest('[data-hp="decor"]');
      if(actual?.dataset.id===id)return{x,y};
    }
  }throw Error(`No unobscured painted decor hit ${id}`);
},id);
const click=async(id,ctrl=false)=>{const p=await hit(id);if(ctrl)await page.keyboard.down('Control');await page.mouse.click(p.x,p.y);if(ctrl)await page.keyboard.up('Control');await settle();};
const select=async ids=>{await click(ids[0]);for(const id of ids.slice(1))await click(id,true);};
const empty=async(hoverOnly=false)=>{
  const p=await card.evaluate(c=>{
    const matrix=c.renderRoot.querySelector('.decorlayer').getScreenCTM();
    const receipt={observed:[]};
    const initial=new DOMPoint(860,790).matrixTransform(matrix);
    const original=c.renderRoot.elementFromPoint(initial.x,initial.y);
    receipt.preferred={x:initial.x,y:initial.y,tag:original?.tagName,classes:original?.getAttribute('class'),stage:!!original?.closest('.stage')};
    const b=c.renderRoot.querySelector('.stage').getBoundingClientRect();
    const left=Math.max(0,b.left),right=Math.min(innerWidth,b.right),top=Math.max(0,b.top),bottom=Math.min(innerHeight,b.bottom);
    for(const fy of [.8,.65,.45,.25])for(const fx of [.2,.4,.6,.8]){
      const p={x:left+(right-left)*fx,y:top+(bottom-top)*fy},target=c.renderRoot.elementFromPoint(p.x,p.y);
      const observed={...p,tag:target?.tagName,classes:target?.getAttribute('class'),stage:!!target?.closest('.stage')};
      receipt.observed.push(observed);
      if(!observed.stage||target?.closest('button,hp-dialog,.editor-secondary,.hp-properties,[data-hp="decor"],.dtframe,.backdropframe'))continue;
      delete receipt.observed;
      receipt.chosen=observed;(window.__1038EmptyReceipts??=[]).push(receipt);return{x:p.x,y:p.y};
    }
    throw Error(`No unobscured empty stage: ${JSON.stringify(receipt)}`);
  });
  if(hoverOnly)await page.mouse.move(p.x,p.y);else await page.mouse.click(p.x,p.y);
  await settle();
};
const shortcut=async key=>{await page.keyboard.press(`Control+${key}`);await settle();};
const drag=async(id,dx=.07,dy=.04,up=true)=>{
  const p=await hit(id),a=await point(.2,.2),b=await point(.2+dx,.2+dy);
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+b.x-a.x,p.y+b.y-a.y,{steps:8});
  if(up){await page.mouse.up();await settle();}return{p,end:{x:p.x+b.x-a.x,y:p.y+b.y-a.y}};
};

try{
  await page.addStyleTag({content:'#host{width:100%;padding:0;margin:0}'});
  await page.evaluate(()=>{
    const c=window.__card,call=c.hass.callWS.bind(c.hass);window.__1038Writes=[];window.__1038Calls=[];
    window.__addRegistryEntity('sensor.group_temperature','kitchen','22.4','demo',{}, {unit_of_measurement:'°C'});
    c.hass={...c.hass,callWS:async message=>{
      window.__1038Calls.push(message.type);
      if(message.type==='houseplan/config/set')window.__1038Writes.push(structuredClone(message));
      if(message.type==='houseplan/assets/resolve')return {assets:message.asset_ids.map(asset_id=>({
        asset_id,name:'synthetic.svg',mime:'image/svg+xml',width:20,height:10,bytes:100,
        url:`/api/houseplan/content/assets/_/${asset_id}.svg`,used_by:[],
      }))};
      if(message.type==='houseplan/content/sign')return {urls:Object.fromEntries(message.paths.map(path=>[
        path,'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><path fill="#7856ab" d="M0 0h20v10H0z"/></svg>'),
      ]))};
      const response=await call(message);
      return message.type==='houseplan/config/get'?{...response,decor_assets_api:1}:response;
    }};
  });
  // R1: a small selected Text set must not enumerate/measure 998 unrelated labels.
  const textScale=[
    {id:'scale-left',kind:'text',x:.2,y:.28,text:'Left {sensor.group_temperature}',size_cm:14},
    {id:'scale-right',kind:'text',x:.5,y:.28,text:'Right',size_cm:14},
    ...Array.from({length:998},(_,i)=>({id:'scale-other-'+i,kind:'text',x:.8,y:.8,text:'Unselected '+i,size_cm:2})),
  ];
  await seed(records());await empty();await seed(textScale);
  await select(['scale-left','scale-right']);
  const textBefore=await state();
  console.log("group.text_scale.initial",JSON.stringify({ids:textBefore.ids,tool:textBefore.tool}));
  check("group.text_scale.initial_selection",textBefore.ids,["scale-left","scale-right"]);
  await page.evaluate(()=>{
    const root=window.__card.renderRoot,selected=new Set(['scale-left','scale-right']);
    const counts={lookups:0,selectedStyle:0,otherStyle:0,selectedBox:0,otherBox:0,otherId:0};
    const attr=Element.prototype.getAttribute,bbox=SVGGraphicsElement.prototype.getBBox,style=window.getComputedStyle,index=root.getElementById;
    const classify=el=>el?.classList?.contains('dtext')&&el.getRootNode()===root
      ?selected.has(attr.call(el,'data-id'))?'selected':'other':null;
    Element.prototype.getAttribute=function(name){if(name==='data-id'&&classify(this)==='other')counts.otherId++;return attr.call(this,name);};
    SVGGraphicsElement.prototype.getBBox=function(...args){const kind=classify(this);if(kind)counts[kind+'Box']++;return bbox.apply(this,args);};
    window.getComputedStyle=function(el,...args){const kind=classify(el);if(kind)counts[kind+'Style']++;return style.call(this,el,...args);};
    root.getElementById=function(id){counts.lookups++;return index.call(this,id);};
    window.__1038TextWork=counts;
    window.__1038RestoreTextWork=()=>{Element.prototype.getAttribute=attr;SVGGraphicsElement.prototype.getBBox=bbox;window.getComputedStyle=style;root.getElementById=index;};
  });
  try{
    for(let i=0;i<6;i++){
      // Public HA delivery with the same authority and equal visible text warms the existing cache.
      await page.evaluate(i=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
        'sensor.group_temperature':{...c.hass.states['sensor.group_temperature'],last_updated:String(i)}}};},i);
      await settle();
    }
    const warmed=await page.evaluate(()=>({...window.__1038TextWork}));
    check('group.text_scale.selected_style_reads',warmed.selectedStyle>=12);
    check('group.text_scale.no_unselected_work',warmed.otherId+warmed.otherStyle+warmed.otherBox,0);
    check('group.text_scale.warm_cache_no_bbox',warmed.selectedBox,0);
    check('group.text_scale.only_selected_index_lookups',warmed.lookups,warmed.selectedStyle);
    await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
      'sensor.group_temperature':{...c.hass.states['sensor.group_temperature'],state:'123.456'}}};});
    await settle();
    check('group.text_scale.changed_text_remeasured',await page.evaluate(()=>window.__1038TextWork.selectedBox),1);
    await drag('scale-left',.03,.02,false);
    check('group.text_scale.live_copy_has_no_duplicate_id',await card.locator('.hp-live-decor text.dtext[id]').count(),0);
    await page.mouse.up();await settle();
    const textAfter=await state(),work=await page.evaluate(()=>({...window.__1038TextWork}));
    console.log('group.text_scale.work',JSON.stringify(work));
    check('group.text_scale.drag_no_unselected_work',work.otherId+work.otherStyle+work.otherBox,0);
    check('group.text_scale.two_selected_contours',await card.locator('.hp-prop-group-contour').count(),2);
    check('group.text_scale.one_write',textAfter.writes,textBefore.writes+1);
    const dx=textAfter.decor[0].x-textBefore.decor[0].x,dy=textAfter.decor[0].y-textBefore.decor[0].y;
    check('group.text_scale.real_delta',Math.abs(dx)>.01&&Math.abs(dy)>.01);
    check('group.text_scale.literal_delta',textAfter.decor.slice(0,2).map(({x,y})=>[Number(x.toFixed(9)),Number(y.toFixed(9))]),
      textBefore.decor.slice(0,2).map(({x,y})=>[Number((x+dx).toFixed(9)),Number((y+dy).toFixed(9))]));
    check('group.text_scale.unselected_unchanged',textAfter.decor.slice(2),textBefore.decor.slice(2));
  }finally{await page.evaluate(()=>window.__1038RestoreTextWork());}
}finally{await finish(browser);}
