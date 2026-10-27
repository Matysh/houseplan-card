import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotDeviceDemand} from '../test-build/render-snapshot-demand.js';
test('active floor retains transitive external light inputs without unrelated floor devices',()=>{
  const devices=[
    {id:'lamp',space:'A',entities:[],marker:{}},
    {id:'relay',space:'B',entities:['switch.remote'],controls:['marker:lamp']},
    {id:'remote',space:'C',entities:['switch.control'],controls:['switch.remote']},
    {id:'other',space:'B',entities:['sensor.unrelated']},
  ];
  assert.deepEqual(snapshotDeviceDemand(devices,'A').map(d=>d.id),['lamp','relay','remote']);
  assert.equal(snapshotDeviceDemand(devices),devices);
  assert.deepEqual(snapshotDeviceDemand(devices,'missing'),[]);
});

test('hidden faces are dormant while hidden light drivers and editor ghosts retain demand',()=>{
  const devices=[
    {id:'lamp',space:'A',entities:[],marker:{}},
    {id:'hidden-driver',space:'A',hidden:true,entities:['switch.remote'],controls:['marker:lamp']},
    {id:'hidden-unrelated',space:'A',hidden:true,entities:['sensor.unused']},
    {id:'removed',space:'A',entities:[],marker:{removed:true}},
  ];
  assert.deepEqual(snapshotDeviceDemand(devices,'A').map(d=>d.id),['lamp','hidden-driver']);
  assert.deepEqual(snapshotDeviceDemand(devices,'A',true).map(d=>d.id),['lamp','hidden-driver','hidden-unrelated']);
});
