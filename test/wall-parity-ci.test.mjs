import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {findStep,runStep} from './helpers/workflow-step.mjs';

test('#845 real CI step executes both parities and propagates either failure',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/validate.yml',import.meta.url),'utf8');
  const step=findStep(workflow,{name:'Сравнить настоящие TS/Python validators (fail closed)'});
  const dir=mkdtempSync(join(tmpdir(),'hp-wall-parity-845-'));
  const python=join(dir,'python'),log=join(dir,'calls');
  const names=['tests_backend/junction_parity.py','tests_backend/wall_node_parity.py'];
  writeFileSync(python,'#!/usr/bin/env bash\nprintf "%s\\n" "$1" >> "$HP_PARITY_LOG"\n'
    +'if [ "$1" = "$HP_PARITY_FAIL" ]; then exit 19; fi\n',{mode:0o755});
  const check=(fail='',script=step.run)=>{
    writeFileSync(log,'');
    const result=runStep(step,script,{cwd:dir,env:{...process.env,PATH:dir+':'+process.env.PATH,
      HP_PARITY_LOG:log,HP_PARITY_FAIL:fail}});
    assert.equal(result.error,undefined);
    assert.equal(result.status,fail?19:0,result.stderr);
    const actual=readFileSync(log,'utf8').trim().split('\n');
    assert.deepEqual(actual,fail===names[0]?names.slice(0,1):names);
  };
  try {
    check();check(names[0]);check(names[1]);
    const omitted=step.run.split('\n').filter(line=>!line.includes('wall_node_parity.py')).join('\n');
    assert.throws(()=>check('',omitted),'removing wall parity cannot be a green witness');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
