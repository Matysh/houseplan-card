import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {ToastPresentation,setToastOwner,toastRootOf,visibleToastBounds,captureToast} from '../test-build/toast-presentation.js';

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

test('#1207 visible plan intersection follows viewport clipping and has a bounded fallback',()=>{
 const viewport={left:0,top:25,right:1000,bottom:625};
 assert.deepEqual(visibleToastBounds({left:100,top:-300,right:740,bottom:500},viewport),{left:100,top:25,right:740,bottom:500});
 assert.deepEqual(visibleToastBounds({left:0,top:900,right:400,bottom:1000},viewport),viewport);
 assert.deepEqual(visibleToastBounds(null,viewport),viewport);
});
test('#1207 hint identity is stable; hints never supersede a message and leave only clears its own hint',()=>{
 const {root,p}=setup();p.showHint('create room','room-face');flush();const notice=root.portal.children[0];
 p.showHint('create room','room-face');assert.equal(frames.size,0);assert.equal(notice.textContent,'create room');
 p.clearHint('other');assert.equal(root.portal.children.length,1);
 p.show('save failed','toast.error');flush();p.showHint('create room','room-face');p.clearHint('room-face');
 assert.equal(notice.textContent,'save failed');assert.equal(notice.dataset.kind,'message');
 p.clear(true);p.showHint('create room','room-face');flush();p.clearHint('room-face');flush();
 assert.equal(root.portal.children.length,0);p.disconnect();
});

test('#1246 card messages never enter a new owner, irrespective of identity or text',()=>{
 const {root,p}=setup(),a=owner(root),b=owner(root);p.show('first','toast.saved');flush();
 const n=root.portal.children[0];assert.equal(n.textContent,'first');assert.equal(n.attributes.get('role'),'alert');
 p.refresh();assert.equal(root.portal.children[0],n);
 assert.equal(n.dataset.id,'toast.saved');
 setToastOwner(root,a,true);assert.equal(root.portal.children[0],n);assert.equal(a.portal().children.length,0);
 assert.equal(n.attributes.get('aria-live'),'assertive');assert.equal(n.attributes.get('role'),'alert');
 setToastOwner(root,b,true);assert.equal(root.portal.children[0],n);assert.equal(b.portal().children.length,0);
 setToastOwner(root,b,false);assert.equal(root.portal.children[0],n);assert.equal(n.textContent,'first');
 assert.equal(n.dataset.id,'toast.saved','moving the notice preserves its message identity');
 p.show('first');assert.equal(n.textContent,'');flush();assert.equal(n.textContent,'first');assert.equal(n.attributes.get('role'),'alert');
 assert.equal(a.portal().children[0],n,'a genuinely new message belongs to its current surface');
 assert.equal(n.dataset.id,'message','unkeyed replacement must not retain the previous key');
 p.disconnect();
});
test('#1246 nested, replacement and retiring owners never acquire another action\'s notice',()=>{
 const {root,p}=setup(),a=owner(root),b=owner(root);setToastOwner(root,a,true);
 p.show('failed','toast.error');flush();const n=a.portal().children[0];
 setToastOwner(root,b,true);p.refresh();assert.equal(a.portal().children[0],n);assert.equal(b.portal().children.length,0);
 assert.equal(frames.size,0,'owner changes do not restart painting');
 setToastOwner(root,a,false);assert.equal(root.portal.children[0],n);assert.equal(b.portal().children.length,0);
 assert.equal(n.attributes.get('aria-live'),'off');assert.equal(n.attributes.has('role'),false);
 p.refresh();assert.equal(root.portal.children[0],n);p.disconnect();
});
test('#1246 delayed callbacks retain the starting card/modal context, including repeated text',()=>{
 const {root,p}=setup(),a=owner(root),b=owner(root);
 const host={_captureToast(){const context=p.captureContext();return (message,id)=>p.show(message,id,'message',context);},_showToast(message,id){p.show(message,id);}};
 const fromCard=captureToast(host);setToastOwner(root,a,true);
 fromCard('same','toast.error');flush();assert.equal(root.portal.children[0].textContent,'same');assert.equal(a.portal().children.length,0);
 const fromA=captureToast(host);setToastOwner(root,b,true);
 fromA('same','toast.error');flush();assert.equal(a.portal().children[0].textContent,'same');assert.equal(b.portal().children.length,0);
 setToastOwner(root,a,false);fromA('same','another.error');flush();assert.equal(root.portal.children[0].textContent,'same');assert.equal(b.portal().children.length,0);
 p.disconnect();
});
test('#1246 accepted retirement never revives a context when the same shell starts a new lifetime',()=>{
 const {root,p}=setup(),a=owner(root);setToastOwner(root,a,true);
 const old=p.captureContext();p.show('old','toast.error','message',old);flush();
 const notice=a.portal().children[0];
 setToastOwner(root,a,false);
 const reopened={host:a.host,portal:a.portal};setToastOwner(root,reopened,true);
 assert.equal(root.portal.children[0],notice);assert.equal(p.isOwnerActive(old),false);
 p.show('late','toast.error','message',old);flush();
 assert.equal(root.portal.children[0],notice);assert.equal(a.portal().children.length,0);
 assert.equal(p.isOwnerActive(p.captureContext()),true);p.disconnect();
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

test('#1147 exit retires announcements immediately; replacement reuses one node and rejects old completion',async t=>{
 const animations=[];
 class AnimatedNode extends NodeStub {
  ownerDocument={defaultView:{matchMedia:()=>({matches:false}),getComputedStyle:()=>({opacity:'0.5',translate:'0 -3px'})}};
  animate(frames,options){
   let resolve,reject;
   const animation={frames,options,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),
    finish:()=>resolve(),cancel:()=>reject(new Error('Cancelled'))};
   animations.push(animation);return animation;
  }
 }
 t.mock.method(globalThis.document,'createElement',()=>new AnimatedNode());
 const {root,p}=setup();p.show('first');flush();const notice=root.portal.children[0];
 assert.equal(animations[0].options.duration,180);
 p.clear();const oldExit=animations.at(-1);
 assert.equal(oldExit.options.duration,140);
 assert.equal(notice.inert,true);assert.equal(notice.attributes.get('aria-hidden'),'true');
 assert.equal(notice.attributes.get('aria-live'),'off');assert.equal(notice.attributes.has('role'),false);
 assert.equal(root.portal.children.length,1,'retain only exit paint');
 p.show('replacement');flush();oldExit.finish();await Promise.resolve();await Promise.resolve();
 assert.deepEqual(root.portal.children,[notice],'a late exit cannot remove the replacement or create a second notice');
 assert.equal(notice.inert,false);assert.equal(notice.textContent,'replacement');
 assert.equal(notice.attributes.get('role'),'alert');assert.equal(notice.attributes.has('aria-hidden'),false);
 p.clear();animations.at(-1).finish();await Promise.resolve();await Promise.resolve();
 assert.equal(root.portal.children.length,0);
 p.show('pending detach');flush();p.disconnect();await Promise.resolve();
 assert.equal(root.portal.children.length,0,'disconnect cancels presentation without leaving a ghost');
});
