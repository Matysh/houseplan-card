import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {ToastPresentation,setToastOwner,toastRootOf} from '../test-build/toast-presentation.js';

// Small DOM adapter, not a second implementation of owner/announcement policy.
class NodeStub {
 constructor(root=null){this.root=root;this.parentElement=null;this.children=[];this.attributes=new Map();this.dataset={};this.textContent='';this.isConnected=true;}
 getRootNode(){return this.root;}
 setAttribute(k,v){this.attributes.set(k,v);}
 removeAttribute(k){this.attributes.delete(k);}
 appendChild(n){n.remove();this.children.push(n);n.parentElement=this;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
 querySelector(){return this.portal;}
}
class Root extends NodeStub {constructor(host){super();this.host=host;this.portal=new NodeStub();}}
const original={document:globalThis.document,ShadowRoot:globalThis.ShadowRoot,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
let next=0;const frames=new Map();
globalThis.document={createElement:()=>new NodeStub()};globalThis.ShadowRoot=Root;
globalThis.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
after(()=>Object.assign(globalThis,original));
const flush=()=>{for(const [id,fn]of [...frames]){frames.delete(id);fn();}};
const setup=()=>{const root=new Root({localName:'houseplan-card'}),p=new ToastPresentation();p.connect(root);return {root,p};};
const owner=root=>{const portal=new NodeStub();return {host:new NodeStub(root),portal:()=>portal};};

test('new text announces once; renders and owner changes preserve one non-live visible node',()=>{
 const {root,p}=setup(),a=owner(root),b=owner(root);p.show('first');flush();
 const n=root.portal.children[0];assert.equal(n.textContent,'first');assert.equal(n.attributes.get('role'),'alert');
 p.refresh();assert.equal(root.portal.children[0],n);
 setToastOwner(root,a,true);assert.equal(a.portal().children[0],n);assert.equal(root.portal.children.length,0);
 assert.equal(n.attributes.get('aria-live'),'off');assert.equal(n.attributes.has('role'),false);
 setToastOwner(root,b,true);assert.equal(b.portal().children[0],n);assert.equal(a.portal().children.length,0);
 setToastOwner(root,b,false);assert.equal(a.portal().children[0],n);assert.equal(n.textContent,'first');
 p.show('first');assert.equal(n.textContent,'');flush();assert.equal(n.textContent,'first');assert.equal(n.attributes.get('role'),'alert');
 p.disconnect();
});
test('replacement and clear/disconnect retire pending frames, no resurrection or cross-card routing',()=>{
 const a=setup(),b=setup(),modal=owner(b.root);setToastOwner(b.root,modal,true);
 a.p.show('old');a.p.show('latest');flush();assert.equal(a.root.portal.children[0].textContent,'latest');assert.equal(modal.portal().children.length,0);
 a.p.show('pending');a.p.clear();flush();assert.equal(a.root.portal.children.length,0);
 b.p.show('pending in modal');b.p.disconnect();flush();assert.equal(modal.portal().children.length,0);
 a.p.disconnect();a.p.connect(a.root);a.p.refresh();flush();assert.equal(a.root.portal.children.length,0);
});
test('detached owners are excluded; nested shadow roots resolve to the same card, not document/global',()=>{
 const {root,p}=setup(),nestedRoot=new Root({localName:'hp-child',getRootNode:()=>root}),a=owner(root);
 assert.equal(toastRootOf(new NodeStub(nestedRoot)),root);
 setToastOwner(root,a,true);a.host.isConnected=false;p.show('root message');flush();assert.equal(root.portal.children[0].textContent,'root message');
 assert.equal(a.portal().children.length,0);p.disconnect();
});
