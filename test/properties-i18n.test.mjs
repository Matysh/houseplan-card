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
