import test from 'node:test';
import assert from 'node:assert/strict';
import { groupColorDraft, readGroupColorDraft, editGroupColor, parseGroupColor, pickerGroupColor } from '../test-build/editors/properties/group-color-draft.js';

const mixed={color:null,opacity:null,mixedColor:true,mixedOpacity:true,alphaOnly:false};
test('#1038 untouched mixed channels remain absent, including focus/open/untouched picker confirmation',()=>{
  const draft=groupColorDraft(mixed),raw=JSON.stringify(draft);
  assert.equal(draft.hex,'');assert.equal(draft.alpha,'');
  assert.deepEqual(parseGroupColor(raw,'stroke'),{ok:true,value:{channel:'stroke'}});
  const untouched=pickerGroupColor(draft,{color:'#607d8b',opacity:1,touched:{color:false,opacity:false}});
  assert.equal(untouched,raw);assert.deepEqual(readGroupColorDraft(untouched),draft);
});
test('#1038 raw mixed edits keep independent touched channels, reject empty/nonfinite alpha and preserve valid zero',()=>{
  const draft=groupColorDraft(mixed);
  assert.deepEqual(parseGroupColor(editGroupColor(draft,'hex','#ABC'),'fill'),{ok:true,value:{channel:'fill',color:'#aabbcc'}});
  assert.deepEqual(parseGroupColor(editGroupColor(draft,'opacity','25'),'stroke'),{ok:true,value:{channel:'stroke',opacity:.25}});
  assert.deepEqual(parseGroupColor(editGroupColor(draft,'opacity','0'),'stroke'),{ok:true,value:{channel:'stroke',opacity:0}});
  for(const value of ['', ' ', 'Infinity', 'NaN', '-1','101','garbage'])
    assert.equal(parseGroupColor(editGroupColor(draft,'opacity',value),'stroke').ok,false,value);
  assert.equal(parseGroupColor(editGroupColor(draft,'hex','badhex'),'stroke').ok,false);
});
test('#1038 picker cause mask never materializes its opposite seed; images accept alpha without a color',()=>{
  const draft=groupColorDraft(mixed);
  assert.deepEqual(parseGroupColor(pickerGroupColor(draft,{color:'#00ff00',opacity:1,touched:{color:true,opacity:false}}),'stroke'),
    {ok:true,value:{channel:'stroke',color:'#00ff00'}});
  assert.deepEqual(parseGroupColor(pickerGroupColor(draft,{color:'#607d8b',opacity:.35,touched:{color:false,opacity:true}}),'stroke'),
    {ok:true,value:{channel:'stroke',opacity:.35}});
  const image=groupColorDraft({...mixed,alphaOnly:true,mixedColor:false});
  assert.deepEqual(parseGroupColor(editGroupColor(image,'opacity','75'),'stroke'),{ok:true,value:{channel:'stroke',opacity:.75}});
  assert.equal(parseGroupColor(editGroupColor(image,'hex','#abcdef'),'stroke').ok,false);
  for(const raw of ['broken','{}','null','{"group":true}'])assert.equal(parseGroupColor(raw,'stroke').ok,false);
});
