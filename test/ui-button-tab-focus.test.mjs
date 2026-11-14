import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireButtonTabFocus, retireButtonTabFocus, focusCompositeButton} from '../test-build/ui-button-tab-focus.js';

function target() {
  const events = new Map();
  return {
    addEventListener(type, listener, options) {
      const listeners = events.get(type) || new Set();
      listeners.add(listener); events.set(type, listeners);
      options?.signal?.addEventListener('abort', () => listeners.delete(listener), {once:true});
    },
    removeEventListener(type, listener) { events.get(type)?.delete(listener); },
    emit(type, event = {}) { for (const listener of [...(events.get(type) || [])]) listener(event); },
    count(type) { return events.get(type)?.size || 0; },
  };
}
function fixture() {
  const document = {...target(), defaultView:target(), activeElement:null};
  const emit = document.emit;
  document.emit = (type, event = {}) => {
    event.composedPath ??= () => [document.activeElement];
    document.defaultView.emit(type,event); emit(type,event);
  };
  const count = document.count;
  document.count = type => ['keydown','keyup'].includes(type) ? document.defaultView.count(type) : count(type);
  const owner = {ownerDocument:document, shadowRoot:{activeElement:null}};
  const classes = new Set();
  const button = {...target(), localName:'button', isConnected:true,
    ownerDocument:document, focus(){},
    classList:{add:value=>classes.add(value), remove:value=>classes.delete(value)}, matches:()=>false};
  document.activeElement = owner; owner.shadowRoot.activeElement = button;
  const marked = () => classes.has('hpf-tab-focus');
  const tab = () => {
    document.emit('keydown', {key:'Tab', isTrusted:true});
    document.emit('keyup', {key:'Tab', isTrusted:true});
  };
  return {document, owner, button, marked, tab, composite:()=>classes.has('hpf-keyboard-current')};
}

test('#1428 native Tab result reaches nested shadow buttons; blur and non-Tab input retire paint', () => {
  const f=fixture(), release=acquireButtonTabFocus(f.owner);
  const nested={shadowRoot:{activeElement:f.button}};
  f.owner.shadowRoot.activeElement=nested;
  f.tab(); assert.equal(f.marked(),true);
  f.button.emit('blur'); assert.equal(f.marked(),false);
  for(const key of ['Escape','Enter',' ','ArrowRight','Shift']) {
    f.document.emit('keydown',{key,isTrusted:true});
    f.document.emit('keyup',{key,isTrusted:true});
    assert.equal(f.marked(),false);
  }
  f.tab(); assert.equal(f.marked(),true);
  f.document.emit('pointerdown'); assert.equal(f.marked(),false);
  release();
});
test('#1428 synthetic/modified Tab, automatic return and foreign focus cannot claim the button',()=>{
  const f=fixture(), release=acquireButtonTabFocus(f.owner);
  for(const event of [{key:'Tab',isTrusted:false},{key:'Tab',isTrusted:true,ctrlKey:true}]){
    f.document.emit('keydown',event); f.document.emit('keyup',{key:'Tab'});
    assert.equal(f.marked(),false);
  }
  f.document.emit('keydown',{key:'Tab',isTrusted:true});
  retireButtonTabFocus(f.owner);
  f.document.emit('keyup',{key:'Tab'}); assert.equal(f.marked(),false);
  f.document.activeElement=f.button; f.tab(); assert.equal(f.marked(),false);
  release();
});
test('#1428 document leases are shared, disposed and idempotent across a fresh mount',()=>{
  const f=fixture(), release=acquireButtonTabFocus(f.owner);
  const other={ownerDocument:f.document}; const second=acquireButtonTabFocus(other);
  assert.equal(f.document.count('keydown'),1);
  release(); assert.equal(f.document.count('keydown'),1);
  second(); assert.equal(f.document.count('keydown'),0);
  const fresh=acquireButtonTabFocus(f.owner);
  second(); assert.equal(f.document.count('keydown'),1);
  f.tab(); assert.equal(f.marked(),true);
  f.document.defaultView.emit('blur'); assert.equal(f.marked(),false);
  fresh(); assert.equal(f.document.count('keydown'),0);
});
test('#1428 only explicit composite navigation paints an arrow/current item; return never does',()=>{
  const f=fixture(), release=acquireButtonTabFocus(f.owner);
  f.document.emit('keydown',{key:'ArrowDown',isTrusted:true});
  f.document.emit('keyup',{key:'ArrowDown',isTrusted:true});
  assert.equal(f.marked(),false); assert.equal(f.composite(),false);
  focusCompositeButton(f.button); assert.equal(f.composite(),true); assert.equal(f.marked(),false);
  f.document.emit('keydown',{key:'Escape',isTrusted:true});
  focusCompositeButton(f.button); assert.equal(f.composite(),false);
  f.document.emit('pointerdown');focusCompositeButton(f.button);assert.equal(f.composite(),false);
  f.document.emit('keydown',{key:'Enter',isTrusted:true});
  focusCompositeButton(f.button);assert.equal(f.composite(),true);
  retireButtonTabFocus(f.owner);assert.equal(f.composite(),false);
  f.document.emit('keydown',{key:'F10',shiftKey:true,isTrusted:true});
  focusCompositeButton(f.button);assert.equal(f.composite(),true);
  release();
});
