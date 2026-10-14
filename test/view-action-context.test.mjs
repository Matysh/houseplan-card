import test from 'node:test';
import assert from 'node:assert/strict';
import { openingActionTargetCurrent, currentMarkerActionDevice } from '../test-build/view-action-context.js';

test('#846 AC6 exact current opening, space, popup and lock are all required', () => {
  const opening = { id:'o1', type:'door', lock:'lock.door' };
  const space = {id:'f1',openings:[opening]};
  const context={spaceId:'f1',id:'o1'};
  assert.equal(openingActionTargetCurrent(space,'f1',context,'o1','lock.door'),true);
  for (const [carrier, active, captured, shown, lock] of [
    [space,'f2',context,'o1','lock.door'],
    [{...space,id:'f2'},'f1',context,'o1','lock.door'],
    [{...space,openings:[]},'f1',context,'o1','lock.door'],
    [{...space,openings:[{...opening,lock:'lock.other'}]},'f1',context,'o1','lock.door'],
    [{...space,openings:[{...opening,type:'passage'}]},'f1',context,'o1','lock.door'],
    [space,'f1',context,'o2','lock.door'],
    [space,'f1',null,'o1','lock.door'],
  ]) assert.equal(openingActionTargetCurrent(carrier,active,captured,shown,lock),false);
});

test('#846 AC6 marker moved/deleted while confirming cannot address another floor', () => {
  const current={id:'m1',space:'f1'}, other={id:'m2',space:'f2'};
  const context={spaceId:'f1',id:'m1'};
  assert.equal(currentMarkerActionDevice([current,other],'f1',context),current);
  assert.equal(currentMarkerActionDevice([{...current,space:'f2'},other],'f1',context),null);
  assert.equal(currentMarkerActionDevice([current,other],'f2',context),null);
  assert.equal(currentMarkerActionDevice([other],'f1',context),null);
});
