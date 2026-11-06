import test,{after} from 'node:test';import assert from 'node:assert/strict';
import {rotationAngle} from '../test-build/rotation-angle.js';
const previousWindow=globalThis.window;globalThis.window={customCards:[]};after(()=>{if(previousWindow)globalThis.window=previousWindow;else delete globalThis.window;});
const {HouseplanEditorRuntime}=await import('../test-build/houseplan-editor-runtime.js');
for(const [initial,start,current,expected]of [[17,0,13,45],[-17,0,-13,-45],[170,170,-170,180],[-170,-170,170,180],[22.5,0,0,45],[-22.5,0,0,-45],[350,0,20,0]])
 test(`#1255 absolute Shift bearing ${initial}/${start}/${current}`,()=>assert.equal(rotationAngle(initial,start,current,true),expected));
for(const kind of ['text','rect','ellipse','furniture','image'])test(`#1255 ${kind}: modifier edges recalculate raw input and save one preview`,()=>{
 const runtime=Object.create(HouseplanEditorRuntime.prototype),shape={id:'x',kind,angle:17},drag={id:'x',kind:'rotate',a0:0,angle0:17,origShape:{...shape},before:{},moved:false};let writes=0,records=0;
 runtime.host={_dtDrag:drag,_mode:'decor',requestUpdate(){}};runtime.backdropGesture={rotationModifier(){}};
 runtime._dtApply=(_id,patch)=>Object.assign(shape,patch);runtime._recordGeometry=()=>records++;runtime._saveConfig=()=>writes++;runtime.host._t=x=>x;
 runtime._dtRotate(12.3,false);const unsnapped=shape.angle;
 assert.ok(Math.abs(unsnapped-(['furniture','image'].includes(kind)?29.3:30))<1e-10);
 runtime._decorRotationKey({key:'Shift',type:'keydown'});assert.equal(shape.angle,45);assert.equal(writes,0);
 runtime._decorRotationKey({key:'Shift',type:'keyup'});assert.equal(shape.angle,unsnapped);
 runtime._decorRotationKey({key:'Shift',type:'keydown'});runtime._dtUp();assert.equal(shape.angle,45);assert.equal(writes,1);assert.equal(records,1);
 runtime._decorRotationKey({key:'Shift',type:'keyup'});assert.equal(shape.angle,45,'release retired the raw input');
});
test('#1255 retired or non-Background gestures do not react to Shift',()=>{
 const runtime=Object.create(HouseplanEditorRuntime.prototype);runtime.host={_dtDrag:null,_mode:'view'};runtime._decorRotationInput={drag:{},pointerAngle:12};
 runtime.backdropGesture={rotationModifier(){throw Error('wrong surface');}};runtime._decorRotationKey({key:'Shift',type:'keydown'});
});

