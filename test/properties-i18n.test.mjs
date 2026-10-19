import test from 'node:test';
import assert from 'node:assert/strict';
import {propertiesT,PROPERTIES_KEYS} from '../test-build/editors/properties/strings.js';
import {t} from '../test-build/i18n.js';

test('#931 all panel copy has RU/EN coverage with matching substitution contracts and English fallback',()=>{
  for(const key of PROPERTIES_KEYS){
    const en=propertiesT('en',key),ru=propertiesT('ru',key);
    assert.ok(typeof en==='string'&&en.trim(),key);assert.ok(typeof ru==='string'&&ru.trim(),key);
    assert.deepEqual(en.match(/\{\w+\}/g)?.sort()??[],ru.match(/\{\w+\}/g)?.sort()??[],key);
    assert.equal(propertiesT('unknown',key),en,key);
  }
  for(const [key,canonical] of [['title','btn.properties'],['copy','btn.copy'],['delete','btn.delete'],['cancel','btn.cancel'],['fill','decor.fill'],['line','decor.line'],['rect','decor.rect'],['ellipse','decor.ellipse'],['furniture','decor.furniture']])
    for(const lang of ['ru','en'])assert.equal(propertiesT(lang,key),t(lang,canonical));
  for(const lang of ['ru','en'])assert.ok(!/Length|Длина/i.test(t(lang,'opening.length_label')));
});

test('#963 changed endpoint/direction/menu copy is translated in all four supported locales',()=>{
  for(const lang of ['en','ru','de','fr']){
    for(const key of ['contour_context','into_room','outside']){
      const value=propertiesT(lang,key,{name:'Custom room'});
      assert.ok(value.trim());assert.ok(!/\{\w+\}/.test(value));
      if(lang!=='en')assert.notEqual(value,propertiesT('en',key,{name:'Custom room'}));
    }
    for(const key of ['markup.rooms','decor.shapes','markup.resize'])assert.ok(t(lang,key)!==key);
    assert.ok(propertiesT(lang,'into_room',{name:'Custom room'}).includes('Custom room'));
  }
});
