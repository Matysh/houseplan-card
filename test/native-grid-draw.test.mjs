import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../test-build/plan-graph.js';
import * as D from '../test-build/graph-draw-binding.js';
import { commitGraphEditResult } from '../test-build/graph-edit-intent.js';
globalThis.window ??= {customCards:[]};
const {HouseplanEditorRuntime}=await import('../test-build/houseplan-editor-runtime.js');
const pitch=1000/240;
function runtime(){
  const sp=G.projectGraphSpace({id:'f',rooms:[]},{version:1,nodes:[],edges:[],rooms:[],dependencies:[]}).space;
  const host={_space:'f',_cfgEpoch:1,_planSnapGeometryCache:null,_spaceModel:()=>sp,_openCuts:()=>[],
    _openingsR:[],_curSpaceCfg:sp,_cellCm:5,_gridPitch:pitch,_path:[],_tool:'draw',_activeWallChainPartitionIds:[],
    _stageEl:{clientWidth:1000,clientHeight:1000},_baseVb:()=>null,_viewOr:()=>({w:1000,h:1000})};
  return Object.assign(Object.create(HouseplanEditorRuntime.prototype),{host,_drawEdgeNodes:new Map()});
}

test('#1237 native grid producer retains exact indices through graph intent, including the witnessed 54/95',()=>{
  const rt=runtime(),a=rt._resolvePlanDrawPoint([225.00000000000003,395.83333333333337],false);
  assert.deepEqual(a.authoredPoint,['l','54','95']);
  rt.host._path=[a.point];rt._chainStartTarget={kind:'independent',node:'start',p:a.authoredPoint};
  const b=rt._resolvePlanDrawPoint([425,395.8333333333333],false);
  assert.deepEqual(b.authoredPoint,['l','102','95'],'near-axis uses the exact known anchor ordinate');
  const sp=rt.host._curSpaceCfg,draft=structuredClone(sp);
  draft.partitions=[{id:'p',a:a.point.map(n=>n/1000),b:b.point.map(n=>n/1000),cm:15}];
  const r=commitGraphEditResult(sp,draft,{kind:'partitions',ids:['p'],endpointRefs:{p:[
    {kind:'independent',node:'start',p:a.authoredPoint},{kind:'independent',node:'end',p:b.authoredPoint}]}});
  assert.deepEqual(r.graph.nodes.find(n=>n.id==='start').p,['l','54','95']);
  assert.deepEqual(r.graph.nodes.find(n=>n.id==='end').p,['l','102','95']);
});

test('#1237 grid provenance does not round an arbitrary authored off-grid endpoint',()=>{
  const sp=runtime().host._curSpaceCfg,draft=structuredClone(sp);
  draft.partitions=[{id:'p',a:[.22500000000000003,.39583333333333337],b:[.723456789,.564738291],cm:15}];
  const result=commitGraphEditResult(sp,draft,{kind:'partitions',ids:['p']});
  assert.deepEqual(result.graph.nodes.find(n=>n.id===result.graph.edges[0].from).p,
    ['q','22500000000000003','100000000000000000','39583333333333337','100000000000000000']);
});

test('#1237 near-axis retirement of an endpoint snap retains the exact chain anchor',()=>{
  const rt=runtime(),sp=G.migrateGraphSpace({id:'f',rooms:[],partitions:[
    {id:'near',a:[.425,.396],b:[.7,.396],cm:15},
  ]}).space;
  rt.host._spaceModel=()=>sp;rt.host._curSpaceCfg=sp;
  rt.host._path=[[225,395.8333333333333]];
  rt._chainStartTarget={kind:'independent',node:'anchor',p:['l','54','95']};
  const result=rt._resolvePlanDrawPoint([425,396],false);
  assert.equal(result.candidate,null,'near-axis must retire the displaced endpoint reference');
  assert.deepEqual(result.authoredPoint,['l','102','95']);
});

test('#1237 native grid indices cover negative, large and fractional pitch projections exactly',()=>{
  for(const [x,y]of [[54,95],[-54,-95],[91,137],[239,240],[-1200000,1200000]]){
    const p=[x*pitch,y*pitch];assert.deepEqual(D.graphDrawGridPoint(p,p,pitch),['l',String(x),String(y)]);
  }
  assert.equal(D.graphDrawGridPoint([.1,.2],[.1,.2],pitch),undefined,'no evidence of a native grid choice');
});

test('#1237 non-grid alignment keeps exact anchor q while preserving the selected grid axis',()=>{
  const p=['q','1','7','2','7'],anchor={point:[1000/7,2000/7],p};
  const target=D.graphDrawGridPoint([102*pitch,2000/7],[102*pitch,69*pitch],pitch,anchor);
  assert.deepEqual(target,['q','17','40','2','7']);
});
