import assert from 'node:assert/strict';
import test from 'node:test';
import { allDecorSelectionIds, decorSelectionMembers, homogeneousDecorKind, toggleDecorSelectionId } from '../test-build/editors/decor/selection.js';
import { decorGroupColorState, styleDecorSelection, translateDecorSelection } from '../test-build/editors/decor/group-edit.js';

const fixture = () => [
  { id:'l',kind:'line',x1:.11,y1:.23,x2:.38,y2:.41,color:'#ff0000',opacity:.2,width_cm:3,line_style:'dashed',future:{deep:[true,1]} },
  { id:'r',kind:'rect',x:.17,y:.29,w:.15,h:.12,angle:17,fill:false,fill_color:'#112233',fill_opacity:.7,future:{keep:'rect'} },
  { id:'e',kind:'ellipse',x:.36,y:.44,w:.24,h:.18,angle:-31,fill:true,fill_color:'#00ff00',fill_opacity:.3 },
  { id:'t',kind:'text',x:.43,y:.57,text:'Room {sensor.temp}',size:'l',scale:1.7,entity:'sensor.temp',attr:'value',unit:'C',angle:13 },
  { id:'f',kind:'furniture',x:.53,y:.62,w:.21,h:.14,angle:41,symbol:'sofa',flip_h:true,flip_v:false,width:2 },
  { id:'i',kind:'image',x:.61,y:.73,w:.18,h:.11,angle:-19,asset_id:'asset-hash',flip_v:true,opacity:.6,future:{bytes:['unchanged']} },
  { id:'other',kind:'rect',x:2.13,y:3.27,w:.4,h:.2,future:{foreign:[false,1]} },
];
const ids=['l','r','e','t','f','i'];

test('#1038 selection is paint-ordered, ID-only and rejects every incomplete or ambiguous request',()=>{
 const items=fixture(), before=structuredClone(items);
 assert.deepEqual(decorSelectionMembers(items,['i','r','l']).map(x=>x.id),['l','r','i']);
 assert.deepEqual(allDecorSelectionIds(items),[...ids,'other']);
 assert.deepEqual(allDecorSelectionIds(items,true),['f']);
 assert.deepEqual(toggleDecorSelectionId(items,['l','i'],'r'),['l','r','i']);
 assert.deepEqual(toggleDecorSelectionId(items,['l','r','i'],'r'),['l','i']);
 assert.deepEqual(toggleDecorSelectionId(items,['l'],'l'),[]);
 assert.deepEqual(allDecorSelectionIds([]),[]);
 for(const selection of [['missing'],['l','missing'],['l','l'],[''],[1]])assert.equal(decorSelectionMembers(items,selection),null);
 assert.equal(decorSelectionMembers([...items,structuredClone(items[0])],['l']),null);
 assert.equal(toggleDecorSelectionId(items,['l','missing'],'l'),null);
 assert.equal(toggleDecorSelectionId(items,['l'],'missing'),null);
 assert.equal(decorSelectionMembers([{...items[0],kind:'future-kind'}],['l']),null);
 assert.deepEqual(items,before);
});

test('#1038 mixed six-kind translation has one literal delta and retains complete foreign/legacy/future records',()=>{
 const items=fixture(), before=structuredClone(items), result=translateDecorSelection(items,ids,.25,-.125);
 assert.equal(result.ok,true);assert.equal(result.changed,true);
 assert.deepEqual(result.decor,[
  {...before[0],x1:.36,y1:.10500000000000001,x2:.63,y2:.285},
  {...before[1],x:.42000000000000004,y:.16499999999999998},
  {...before[2],x:.61,y:.315},
  {...before[3],x:.6799999999999999,y:.44499999999999995},
  {...before[4],x:.78,y:.495},
  {...before[5],x:.86,y:.605},before[6],
 ]);
 assert.deepEqual(items,before);
 result.decor[0].future.deep[0]='changed';result.decor[6].future.foreign.push('changed');
 assert.deepEqual(items,before,'returned carrier and foreign nested values do not alias input');
 const noop=translateDecorSelection(items,ids,0,0);assert.equal(noop.ok,true);assert.equal(noop.changed,false);assert.deepEqual(noop.decor,before);
 assert.equal(translateDecorSelection(items,[],1,1).changed,false);
});

test('#1038 any invalid member, delta or stored-axis bound refuses the entire translation without clamping',()=>{
 const items=fixture(), before=structuredClone(items);
 for(const [dx,dy] of [[Infinity,0],[0,NaN],[true,0],[5000,0],[0,-5001]])assert.equal(translateDecorSelection(items,ids,dx,dy).ok,false);
 for(const selected of [['l','missing'],['f','f']])assert.equal(translateDecorSelection(items,selected,.1,.1).ok,false);
 const limit=[{id:'near',kind:'rect',x:4999.5,y:0,w:.5,h:.5},{id:'free',kind:'text',x:0,y:0,text:'Keep'}];
 assert.equal(translateDecorSelection(limit,['near','free'],.125,0).ok,false,'no member may be clamped while another moves');
 assert.deepEqual(limit,[{id:'near',kind:'rect',x:4999.5,y:0,w:.5,h:.5},{id:'free',kind:'text',x:0,y:0,text:'Keep'}]);
 const rotated=[{id:'rot',kind:'rect',x:4998,y:0,w:1,h:1,angle:45}];
 assert.equal(translateDecorSelection(rotated,['rot'],1,0).ok,true,'rotation does not add a new paint-corner bound to valid stored coordinates');
 assert.equal(translateDecorSelection(rotated,['rot'],1.01,0).ok,false,'stored x+w exceeds the existing native bound');
 assert.equal(translateDecorSelection([{...items[0],x1:NaN}],['l'],1,0).ok,false);
 assert.deepEqual(items,before);
});

test('#1038 strict same-kind matrix permits different furniture/text/image identities and independent mixed channels',()=>{
 const items=fixture();assert.equal(homogeneousDecorKind(items.slice(0,2)),null);
 for(const kind of ['line','rect','ellipse','text','furniture','image']){
  const one=items.find(x=>x.kind===kind), group=[one,{...one,id:'second',color:'#0000ff',opacity:.8,symbol:'table',text:'Other {sensor.hum}',asset_id:'other-hash'}];
  assert.equal(homogeneousDecorKind(group),kind);
  const stroke=decorGroupColorState(group,'stroke',5);assert.ok(stroke);assert.equal(stroke.alphaOnly,kind==='image');
  assert.equal(stroke.opacity,null);assert.equal(stroke.mixedOpacity,true);
  assert.equal(stroke.color,null);assert.equal(stroke.mixedColor,kind!=='image');
  assert.equal(!!decorGroupColorState(group,'fill',5),kind==='rect'||kind==='ellipse');
 }
 assert.equal(decorGroupColorState(items,'stroke',5),null);
 const fields=[{...items[1],fill:true,fill_opacity:.2},{...items[1],id:'off',fill:false,fill_opacity:.7}];
 assert.deepEqual(decorGroupColorState(fields,'fill',5),{color:'#112233',opacity:null,mixedColor:false,mixedOpacity:true,alphaOnly:false});
});

test('#1038 color-only and alpha-only preserve every opposite per-object value, flags and optional absence',()=>{
 const items=[{id:'a',kind:'rect',x:0,y:0,w:1,h:1,color:'#ff0000',opacity:.2,fill:true,fill_color:'#123456',fill_opacity:.3,future:{keep:[true]}},
  {id:'b',kind:'rect',x:2,y:0,w:1,h:1,color:'#0000ff',opacity:.8,fill:false,fill_color:'#654321',fill_opacity:.7,future:{keep:[1]}}];
 const before=structuredClone(items);
 assert.deepEqual(styleDecorSelection(items,['a','b'],{channel:'stroke',color:'#ABC'},5).decor,[{...before[0],color:'#aabbcc'},{...before[1],color:'#aabbcc'}]);
 assert.deepEqual(styleDecorSelection(items,['a','b'],{channel:'stroke',opacity:.5},5).decor,[{...before[0],opacity:.5},{...before[1],opacity:.5}]);
 assert.deepEqual(styleDecorSelection(items,['a','b'],{channel:'fill',opacity:.4},5).decor,[{...before[0],fill_opacity:.4},{...before[1],fill_opacity:.4}]);
 assert.deepEqual(styleDecorSelection(items,['a','b'],{channel:'fill',color:'#ABCDEF'},5).decor,[{...before[0],fill_color:'#abcdef'},{...before[1],fill_color:'#abcdef'}]);
 const omitted=[{id:'one',kind:'line',x1:0,y1:0,x2:1,y2:0},{id:'two',kind:'line',x1:0,y1:1,x2:1,y2:1,color:'#607d8b',opacity:.2}];
 const sameColor=styleDecorSelection(omitted,['one','two'],{channel:'stroke',color:'#607D8B'},5);
 assert.equal(sameColor.changed,false);assert.deepEqual(sameColor.decor,omitted);
 const alpha=styleDecorSelection(omitted,['one','two'],{channel:'stroke',opacity:1},5);
 assert.deepEqual(alpha.decor,[omitted[0],{...omitted[1],opacity:1}]);assert.equal(Object.hasOwn(alpha.decor[0],'opacity'),false);
 assert.deepEqual(styleDecorSelection(items,['a','b'],{channel:'stroke'},5).decor,items);
 assert.deepEqual(items,before);
});

test('#1038 image is alpha-only and invalid/mixed/forged style input never applies to a subset',()=>{
 const images=[{id:'a',kind:'image',x:0,y:0,w:1,h:1,asset_id:'first',future:{keep:true}},
  {id:'b',kind:'image',x:2,y:0,w:1,h:1,asset_id:'second',opacity:.5,color:'#123456',flip_h:true}];
 const before=structuredClone(images),result=styleDecorSelection(images,['a','b'],{channel:'stroke',opacity:.25},5);
 assert.deepEqual(result.decor,[{...before[0],opacity:.25},{...before[1],opacity:.25}]);
 assert.equal(Object.hasOwn(result.decor[0],'color'),false,'no dummy color is introduced');
 for(const patch of [{channel:'stroke',color:'#ff0000'},{channel:'fill',opacity:.2},{channel:'stroke',opacity:-.1},{channel:'stroke',opacity:Infinity},{channel:'stroke',opacity:true},{channel:'stroke',opacity:.2,noFill:true}])assert.equal(styleDecorSelection(images,['a','b'],patch,5).ok,false);
 assert.equal(styleDecorSelection(fixture(),['l','t'],{channel:'stroke',color:'#ff0000'},5).ok,false);
 assert.equal(styleDecorSelection(fixture(),['l','missing'],{channel:'stroke',opacity:.3},5).ok,false);
 result.decor[0].future.keep='mutated';assert.deepEqual(images,before);
});

test('#1038 quota-sized selection and style operation retain all 1000 IDs, paint order and only one requested channel',()=>{
 const items=Array.from({length:1000},(_,i)=>({id:'r'+i,kind:'rect',x:i/1000,y:.25,w:.01,h:.01,color:i%2?'#ff0000':'#0000ff',opacity:(i%10)/10,future:{index:i}}));
 const selected=allDecorSelectionIds(items),before=structuredClone(items),result=styleDecorSelection(items,selected,{channel:'stroke',opacity:.75},5);
 assert.equal(result.ok,true);assert.equal(result.changed,true);assert.equal(result.decor.length,1000);
 assert.deepEqual(result.decor.map(x=>x.id),before.map(x=>x.id));
 assert.deepEqual(result.decor,before.map(x=>({...x,opacity:.75})));
 assert.deepEqual(items,before);
});
