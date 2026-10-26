import test from 'node:test';
import assert from 'node:assert/strict';
import { saveRoomEdit } from '../test-build/editors/room-save.js';
import { rememberRoomBaseline, roomDirty } from '../test-build/editors/room-form-state.js';

function fixture(settings = {}) {
  const room = { id:'r1',name:'Living room',area:null,poly:[[0,0],[1,0],[1,1]],settings };
  const config = { version:8,spaces:[{id:'f1',rooms:[room]}],markers:[] };
  let payload;
  const host = { _serverCfg:config,_space:'f1',_roomEditId:'r1',_roomDialog:true,isConnected:true,
    _nameSel:'Living room edited',_areaSel:'',_roomFill:'',_roomCustomFill:null,
    _roomTempMin:'',_roomTempMax:'24',_roomTempSrc:'entity:sensor.missing',_roomHumSrc:'',
    _roomCo2Src:'entity:sensor.air',_roomNameScale:1.1,_roomLabelScale:.9,
    _saveConfigDebounced:{pending:()=>false},_maybeRebuildDevices(){},requestUpdate(){},
    _showToast(){},_t:key=>key,
  };
  const runtime = { host,_stageOptimisticConfig:(base,candidate)=>({base,candidate}),
    _saveConfigNow:async attempt=>{payload=attempt.candidate;},
  };
  return {host,runtime,original:structuredClone(config),payload:()=>payload};
}

test('#1078 the room draft is local, dirty on sunlight changes and sparse on accepted save', async()=>{
  for (const enabled of [true,false]) {
    const f=fixture({future:{keep:true},sun_transparent:!enabled});
    f.host._roomSunTransparent=!enabled;
    rememberRoomBaseline(f.host);
    assert.equal(roomDirty(f.host),false);
    f.host._roomSunTransparent=enabled;
    assert.equal(roomDirty(f.host),true);
    assert.deepEqual(f.host._serverCfg,f.original,'draft changes never alter the plan before Save');
    await saveRoomEdit(f.runtime);
    const settings=f.payload().spaces[0].rooms[0].settings;
    assert.equal(settings.sun_transparent,enabled ? true : undefined);
    assert.deepEqual(settings.future,{keep:true});
    assert.deepEqual(f.host._serverCfg,f.original);
  }
});

test('#946 actual Room save preserves unknowns, unavailable sources and independent inheritance',async()=>{
  const f=fixture({future:{x:42},temp_max:24,temp_source:'entity:sensor.missing',co2_source:'entity:sensor.air'});
  await saveRoomEdit(f.runtime);
  const saved=f.payload().spaces[0].rooms[0];
  assert.equal(saved.area,null);
  assert.deepEqual(saved.settings,{future:{x:42},temp_max:24,temp_source:'entity:sensor.missing',co2_source:'entity:sensor.air',name_scale:1.1,label_scale:.9});
  assert.deepEqual(f.host._serverCfg,f.original,'preparing the payload does not mutate the adopted config');
  assert.equal('fill_mode' in saved.settings,false,'the effective Space mode is never materialized');
  assert.equal('temp_min' in saved.settings,false,'the lower bound independently inherits');
  assert.equal('glow' in saved.settings,false,'ordinary plans receive no unnecessary override');
});

test('#946 removed room glow prohibition is retired only by an ordinary save',async()=>{
  for(const previous of [{glow:false},{fill_mode:'glow'}]){
    const f=fixture({...previous,future:12});
    assert.deepEqual(f.host._serverCfg,f.original,'opening/preparing the form writes nothing');
    await saveRoomEdit(f.runtime);
    assert.equal(f.payload().spaces[0].rooms[0].settings.glow,true);
    assert.equal(f.payload().spaces[0].rooms[0].settings.future,12);
  }
});
