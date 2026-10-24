import assert from 'node:assert/strict';
import test from 'node:test';
import { DecorGroupTextBoxes } from '../test-build/editors/decor/group-selection.js';
import { decorTextElementId } from '../test-build/decor-text-element.js';

test('#1038 selected Text uses literal indexed IDs, keeps warm geometry and refreshes changed text/font',()=>{
  const original=globalThis.getComputedStyle,reads=[],lookups=[];
  const a={id:'a:["#]',kind:'text',x:.1,y:.2},b={id:'b',kind:'text',x:.4,y:.3};
  const element=(id,x,y)=>({textContent:id,fontSize:'16px',getBBox(){reads.push(id);return {x,y,width:40,height:20};}});
  const first=element(a.id,90,190),second=element(b.id,390,290);
  const index=new Map([[decorTextElementId(a.id),first],[decorTextElementId(b.id),second]]);
  const root={getElementById(id){lookups.push(id);return index.get(id)??null;},
    querySelector(){throw Error('Text lookup must use the root index');},querySelectorAll(){throw Error('No full Text enumeration');}};
  globalThis.getComputedStyle=node=>({fontFamily:'sans-serif',fontSize:node.fontSize,fontWeight:'400',letterSpacing:'normal'});
  try{
    const boxes=new DecorGroupTextBoxes();
    assert.equal(boxes.measure([a,b],root),true);
    assert.deepEqual(reads,[a.id,b.id]);assert.deepEqual(lookups,[decorTextElementId(a.id),decorTextElementId(b.id)]);
    assert.deepEqual(boxes.get({...a,x:.2,y:.4}),{x:190,y:390,w:40,h:20});
    assert.equal(boxes.measure([a,b],root),false);assert.equal(reads.length,2);
    first.textContent='Live HA value';assert.equal(boxes.measure([a,b],root),true);assert.equal(reads.length,3);
    second.fontSize='20px';assert.equal(boxes.measure([a,b],root),true);assert.equal(reads.length,4);
    assert.equal(boxes.measure([b],root),false);assert.equal(boxes.get(a),null);
    boxes.measure([],root);assert.equal(boxes.get(b),null);
    assert.equal(boxes.measure([a],root),true);assert.equal(reads.length,5);
    index.delete(decorTextElementId(a.id));boxes.clear();assert.equal(boxes.measure([a],root),false);
    assert.equal(boxes.get(a),null);
  }finally{globalThis.getComputedStyle=original;}
});
