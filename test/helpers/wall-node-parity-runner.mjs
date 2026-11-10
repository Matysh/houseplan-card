// CLI for the mandatory Python harness. Only fixture generation and actual TS calls.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {loadWallIdentityCorpus,withCorpusIds} from './wall-identity-corpus.mjs';

const build=process.env.HP_WALL_PARITY_BUILD;
if(!build)throw Error('HP_WALL_PARITY_BUILD is required');
const model=await import(pathToFileURL(resolve(build,'wall-segment-model.js')).href);
const nodesModule=await import(pathToFileURL(resolve(build,'wall-node-move.js')).href);
const {applyNodeMove,prepareNodeMove,structuralWallNodes}=nodesModule;
const commit=input=>withCorpusIds(()=>model.commitWallSegmentModel(input).config);
const reason=error=>error.reason??String(error);
let input='';for await(const chunk of process.stdin)input+=chunk;
const request=JSON.parse(input);
if(request.action==='corpus'){
  const corpus=await loadWallIdentityCorpus();
  console.log(JSON.stringify(corpus.entries.map(c=>{
    try{const base=commit(c.input);return {...c,ok:true,base,repeat:commit(base)};}
    catch(error){return {...c,ok:false,reason:reason(error)};}
  })));
}else if(request.action==='delete'){
  const {applyNodeDelete}=await import(pathToFileURL(resolve(build,'wall-node-delete.js')).href);
  console.log(JSON.stringify(request.cases.map(c=>{
    const before=c.mode==='pure'?c.input:commit(c.input);
    const intentFor=space=>{
      const node=structuralWallNodes(space).find(n=>Math.hypot(n.point[0]-c.point[0],n.point[1]-c.point[1])<1e-8);
      return {point:c.point,...(node?.nodeId?{node_id:node.nodeId}:{})};
    };
    const intent=intentFor(before.spaces[0]),result=applyNodeDelete(before.spaces[0],intent);
    const currentBefore=commit(before),currentIntent=intentFor(currentBefore.spaces[0]);
    const currentResult=applyNodeDelete(currentBefore.spaces[0],currentIntent);
    return {name:c.name,before,intent,...result,...(result.ok?{after:commit({...before,
      spaces:before.spaces.map((s,i)=>i===0?result.space:s)})}: {}),
      current:{before:currentBefore,intent:currentIntent,...currentResult,
        ...(currentResult.ok?{after:commit({...currentBefore,spaces:[currentResult.space]})}:{})}};
  })));
}else if(request.action==='cross'){
  console.log(JSON.stringify(request.configs.map(c=>commit(c))));
}else{
  console.log(JSON.stringify(request.cases.map(c=>{
    try{
      const base=c.mode==='pure'?c.input:commit(c.input);
      const space=base.spaces[0],nodes=structuralWallNodes(space);
      const intents=c.intents??(c.intent?[c.intent]:nodes.flatMap(node=>{
        return [[1/240,0],[-1/240,0],[0,1/240],[0,-1/240]].map(d=>{
          const passing=node.axes.filter(a=>a.passing);
          const axis=passing.length===1?passing[0]:passing.find(a=>Math.abs(d[0]*a.direction[1]-d[1]*a.direction[0])<1e-9);
          return {point:node.point,target:[node.point[0]+d[0],node.point[1]+d[1]],axis:axis?.key??null,split_ids:{}};
        });
      }));
      const moves=intents.map(intent=>{
        const node=nodes.find(n=>Math.hypot(n.point[0]-intent.point[0],n.point[1]-intent.point[1])<1e-8);
        if(!node)throw Error(c.name+': fixture node is missing');
        if(node.nodeId)intent.node_id=node.nodeId;
        // Frozen model10 fixtures name a former carrier ID. The current UI
        // chooses its axis after migration. Translate only a proven historical
        // carrier to its unique current passing axis; arbitrary invalid IDs
        // remain invalid and the fixture's acceptance assertion stays intact.
        if(c.expected?.config?.model_version===10&&intent.axis&&!node.axes.some(a=>a.key===intent.axis)){
          const old=c.expected.config.spaces[0].wall_segments.find(w=>'wall:'+w.id===intent.axis);
          if(old){
            const dx=old.b[0]-old.a[0],dy=old.b[1]-old.a[1],length=Math.hypot(dx,dy);
            const axes=node.axes.filter(a=>a.passing
              && Math.abs(dx*a.direction[1]-dy*a.direction[0])<=length*1e-9
              && Math.abs((node.point[0]-old.a[0])*dy-(node.point[1]-old.a[1])*dx)<=length*1e-9);
            if(axes.length!==1)throw Error(c.name+': historical carrier has no unique current axis');
            intent.axis=axes[0].key;
          }
        }
        const result=applyNodeMove(prepareNodeMove(space,node,nodes,intent.split_ids),intent.target,intent.axis);
        if(!result.ok)return {intent,...result};
        try{const after=commit({...base,spaces:[result.space]});return {intent,ok:true,after,repeat:commit(after)};}
        catch(error){return {intent,ok:false,reason:reason(error)};}
      });
      return {...c,ok:true,base,repeat:c.mode==='pure'?null:commit(base),moves};
    }catch(error){return {...c,ok:false,reason:reason(error)};}
  })));
}
