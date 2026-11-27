import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { S6_LIMITS, budgetForS6, estimateS6, optionalFitsS6, s6PlanIdentity } from '../lib/s6-budget.mjs';
import { planProfile } from '../lib/catalog.mjs';
import { reusableS6Steps, runPlan } from '../lib/runner.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const plan = (track, steps) => ({ event:'task', layer:'product', scope:{track}, steps });
const step = (id, props = {}) => ({ id, name:id, command:['node','-e',''], inputs:['input'], ...props });

test('all three S6 caps count new steps and preparation, with independent time and count boundaries', () => {
  for (const track of ['ship','show','ask']) {
    const limit = S6_LIMITS[track];
    const steps = Array.from({length:limit.steps}, (_,i) => step('node:'+i));
    assert.equal(budgetForS6(plan(track,steps)).reasons.length,0);
    const added = [...steps,step('extra')];
    assert.match(budgetForS6(plan(track,added)).reasons[0], /обязательных запусков/);
    assert.equal(budgetForS6(plan(track,added), {reused:new Set(['extra'])}).estimate.steps, limit.steps);
    const prepared = plan(track,[step('product-build')]);
    const inside = new Map([['product-build',Math.floor(limit.ms/1.1)]]);
    const outside = new Map([['product-build',limit.ms]]);
    assert.equal(budgetForS6(prepared,{observed:inside}).reasons.length,0);
    assert.match(budgetForS6(prepared,{observed:outside}).reasons[0], /прогноз/);
    assert.equal(budgetForS6(prepared,{observed:outside,mode:'github'}).reasons.length,0);
  }
});

test('forecast includes prerequisites and drains for exclusive tests', () => {
  const steps = [step('build'),step('ordinary',{requires:['build']}),step('exclusive',{requires:['build'],exclusive:true}),step('last')];
  const observed = new Map(steps.map(({id})=>[id,10_000]));
  assert.equal(estimateS6(steps,{observed}).ms,33_000);
  assert.equal(estimateS6(steps,{observed,reused:new Set(['build','exclusive'])}).steps,2);
});

test('actual budget leaves mandatory overflow incomplete, preserves failed assertions, and reuses valid executions', async t => {
  const dir = mkdtempSync(join(tmpdir(),'hp-s6-budget-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'input'),'original');
  const p = plan('ship',[step('early'),step('second',{requires:['early']}),step('late',{requires:['second']})]);
  const calls=[];
  const execute= async s=>{calls.push(s.id);return {status:'passed',durationMs:1};};
  const exceeded=await runPlan(p,{root:dir,jobs:2,execute,budget:{steps:2}});
  assert.equal(exceeded.status,'budget-exceeded');
  assert.deepEqual(calls,['early','second']);
  assert.deepEqual([...reusableS6Steps(p,{root:dir})],['early','second']);
  const repeat=await runPlan(p,{root:dir,execute,budget:{steps:1}});
  assert.deepEqual(repeat.results.map(r=>r.status),['reused','reused','passed']);
  const failure=await runPlan(p,{root:dir,reuse:false,budget:{steps:1},execute:async()=>({status:'failed',durationMs:1})});
  assert.equal(failure.status,'failed');
  writeFileSync(join(dir,'input'),'changed');
  assert.equal(reusableS6Steps(p,{root:dir}).size,0);
});

test('deadline cancels the running step and prevents new mandatory work', async t => {
  const dir=mkdtempSync(join(tmpdir(),'hp-s6-deadline-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const p=plan('ship',[step('slow'),step('after',{requires:['slow']})]);
  const calls=[];
  const result=await runPlan(p,{root:dir,budget:{deadline:performance.now()+200,ms:200},execute:async(s,{signal})=>{
    calls.push(s.id);
    await new Promise(resolve=>signal.aborted?resolve():signal.addEventListener('abort',resolve,{once:true}));
    return {status:'cancelled',durationMs:200};
  }});
  assert.equal(result.status,'budget-exceeded');
  assert.deepEqual(calls,['slow']);
  assert.deepEqual(result.results.map(x=>x.status),['budget-exceeded','budget-exceeded']);
});

test('icon picker keeps its real browser witness, space settings fits Ship, and reserve has the same mandatory plan', async () => {
  for (const track of ['ship','show','ask']) {
    const options={root,track,changedFiles:['src/editors/hp-icon-picker.ts']};
    const wsl=await planProfile(options), github=await planProfile({...options,s6Host:'github'});
    assert.ok(wsl.steps.some(s=>s.id==='smoke:smoke_device_icon_picker'));
    assert.ok(!wsl.steps.some(s=>s.command?.includes('test/icon-picker.test.mjs')));
    assert.equal(s6PlanIdentity({...wsl,steps:wsl.steps.filter(s=>!s.s6Optional)}),s6PlanIdentity(github));
    if(track==='ship') assert.match(wsl.selection.budget.reasons.join(),/прогноз/);
  }
  const settings=await planProfile({root,track:'ship',changedFiles:['src/editors/space-dialog-draft.ts']});
  assert.ok(settings.steps.some(s=>s.command?.includes('test/space-settings-945.test.mjs')));
  assert.equal(settings.selection.budget.reasons.length,0);
});

test('metadata-only additions to a mixed product diff do not expand coverage', async () => {
  const data={root,track:'show',changedFiles:['demo/serve.mjs']};
  const a=await planProfile(data);
  const b=await planProfile({...data,changedFiles:[...data.changedFiles,'.gitignore','docs/release-ledger/example.json']});
  assert.ok(a.steps.filter(s=>s.id.startsWith('smoke:')).length < 5);
  assert.equal(s6PlanIdentity(a),s6PlanIdentity(b));
});

test('optional checks use only known spare time and count', () => {
  const optional=step('smoke:smoke_space_settings_form');
  const expensive=step('smoke:smoke_device_icon_picker');
  assert.equal(optionalFitsS6([step('product-build')],optional,{track:'ship'}),true);
  assert.equal(optionalFitsS6([step('product-build')],expensive,{track:'ship'}),false);
  assert.equal(optionalFitsS6([step('product-build')],step('unknown'),{track:'ship'}),false);
  assert.equal(optionalFitsS6(Array.from({length:16},(_,i)=>step('x'+i)),optional,{track:'ship'}),false);
});

test('adding unrelated smoke consumers does not expand the shared launcher witness set', async t => {
  const dir=mkdtempSync(join(tmpdir(),'hp-s6-launcher-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  mkdirSync(join(dir,'demo'));
  writeFileSync(join(dir,'demo/serve.mjs'),'export const launch = () => {};');
  writeFileSync(join(dir,'demo/smoke_readonly_cold_start.mjs'),'import { launch } from "./serve.mjs"; launch();');
  const options={root:dir,track:'ship',changedFiles:['demo/serve.mjs']};
  const before=await planProfile(options);
  for(let i=0;i<120;i++) writeFileSync(join(dir,'demo','smoke_unrelated_'+i+'.mjs'),'import { launch } from "./serve.mjs"; launch();');
  const after=await planProfile(options);
  assert.ok(after.steps.some(s=>s.id==='smoke:smoke_readonly_cold_start'));
  assert.deepEqual(after.steps.map(s=>s.id),before.steps.map(s=>s.id));
});

test('optional work skipped at the deadline leaves verified mandatory coverage intact', async t => {
  const dir=mkdtempSync(join(tmpdir(),'hp-s6-optional-stop-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const p=plan('ship',[step('required'),step('optional',{s6Optional:true,after:['required']})]);
  const result=await runPlan(p,{root:dir,budget:{deadline:performance.now()+200,ms:200},execute:async(s,{signal})=>{
    if(s.id==='required') return {status:'passed',durationMs:1};
    await new Promise(resolve=>signal.aborted?resolve():signal.addEventListener('abort',resolve,{once:true}));
    return {status:'cancelled',durationMs:200};
  }});
  assert.equal(result.status,'passed');
  assert.deepEqual(result.results.map(x=>x.status),['passed','not-required']);
});
