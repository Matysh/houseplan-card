/** Synthetic inputs for benchmark-node-save.py; no owner HA data. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';
import {projectGraphSpace} from '../test-build/plan-graph.js';
import {structuralWallNodes} from '../test-build/wall-node-move.js';
const out=resolve(process.argv[2]||'artifacts/node-save-inputs');mkdirSync(out,{recursive:true});
const base=commitWallSegmentModel({model_version:10,spaces:[{id:'f',title:'Synthetic',view_box:[-.5,-.5,3,3],cell_cm:5,
  rooms:[],openings:[],partitions:[{id:'a',a:[0,0],b:[1,0],cm:0},{id:'b',a:[1,1],b:[2,1],cm:0}]}],markers:[],
  settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}}).config;
const source=structuralWallNodes(base.spaces[0]).find(n=>n.point[0]===0&&n.point[1]===0);
for(const size of [100,1000,5000]){
  const graph=structuredClone(base.spaces[0].plan_graph);
  for(let i=0;i<size-2;i++){
    const x=720+(i%100)*8,y=480+Math.floor(i/100)*8,id='perf-'+String(i).padStart(4,'0');
    graph.nodes.push({id:id+'a',p:['l',String(x),String(y)]},{id:id+'b',p:['l',String(x+4),String(y)]});
    graph.edges.push({kind:'wall',id,from:id+'a',to:id+'b',cm:0});
  }
  const config=commitWallSegmentModel({...base,spaces:[projectGraphSpace(base.spaces[0],graph).space]}).config;
  writeFileSync(resolve(out,size+'.json'),JSON.stringify({config,space_id:'f',direction:'apply',intent:{point:[0,0],target:[-.25,.25],
    target_p:['l','-60','60'],node_id:source.nodeId,axis:null,split_ids:{}}}));
}
console.log(out);
