import assert from 'node:assert/strict';
import test from 'node:test';
import { nothing } from 'lit';
import { panelMenuState, panelMenuKey, renderPanelMenu } from '../test-build/panel-header-menu.js';

const state = (hass,narrow=false,kiosk=false) => panelMenuState(hass,narrow,kiosk,'Sidebar');
test('#1120 public HA menu policy covers modern and minimum field sets without subscriptions', () => {
  for (const kioskMode of [false,undefined]) {
    const hass = {kioskMode,dockedSidebar:'auto'};
    assert.equal(state(hass).visible,false);
    assert.equal(state(hass,true).visible,true);
    assert.equal(state({...hass,dockedSidebar:'always_hidden'}).visible,true);
    assert.equal(state({...hass,dockedSidebar:'always_hidden'},false,true).visible,false);
    for (const narrow of [false,true])
      assert.equal(state({...hass,dockedSidebar:'always_hidden',kioskMode:true},narrow).visible,false);
    for (const narrow of [false,true])
      assert.equal(state({...hass,dockedSidebar:'always_hidden',auth:{external:{config:{hasSidebar:true}}}},narrow).visible,false);
    assert.equal(state({...hass,auth:{external:{config:{hasSidebar:false}}}},true).visible,true);
  }
  for (const hass of [undefined,null,{}, {auth:{}}, {auth:{external:{}}}, {auth:{external:{config:{}}}}])
    assert.equal(state(hass,true).visible,true,'legacy optional sections do not hide the native narrow menu');
});

test('#1120 localization prefers the native name, rejects untranslated keys and retains a fallback', () => {
  const labels = {'ui.sidebar.sidebar_toggle':'Native sidebar','ui.common.menu':'Old menu'};
  assert.equal(state({localize:key=>labels[key]},true).label,'Native sidebar');
  assert.equal(state({localize:key=>key==='ui.common.menu'?'Legacy menu':key},true).label,'Legacy menu');
  assert.equal(state({localize:key=>key},true).label,'Sidebar');
  assert.equal(state({localize:()=>undefined},true).label,'Sidebar');
});

test('#1120 safe projection detects in-place policy/name changes and ignores unrelated HA ticks', () => {
  const hass = {kioskMode:false,dockedSidebar:'auto',localize:()=> 'Menu'};
  const first = panelMenuKey(hass,false,'Sidebar');
  hass.sensorValue = 3;
  assert.equal(panelMenuKey(hass,false,'Sidebar'),first);
  hass.dockedSidebar = 'always_hidden';
  const hidden = panelMenuKey(hass,false,'Sidebar'); assert.notEqual(hidden,first);
  hass.localize = ()=> 'Menü';
  assert.notEqual(panelMenuKey(hass,false,'Sidebar'),hidden);
  hass.auth = {external:{config:{hasSidebar:true}}};
  assert.equal(JSON.parse(panelMenuKey(hass,false,'Sidebar'))[0],false);
  assert.equal(renderPanelMenu({visible:false,label:'Sidebar'}),nothing);
});

test('#1120 plain menu button emits exactly one public bubbling/composed event from a click', () => {
  const old = globalThis.CustomEvent;
  globalThis.CustomEvent = class extends Event {
    constructor(type,options) { super(type,options); }
  };
  try {
    const template = renderPanelMenu({visible:true,label:'Native menu'});
    const onClick = template.values.find(value=>typeof value==='function');
    const events = [];
    onClick({currentTarget:{dispatchEvent:event=>events.push(event)}});
    assert.equal(events.length,1);
    assert.equal(events[0].type,'hass-toggle-menu');
    assert.equal(events[0].bubbles,true);
    assert.equal(events[0].composed,true);
    assert.ok(template.values.includes('Native menu'));
  } finally {
    if (old === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = old;
  }
});
