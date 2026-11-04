import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { GitAdapter, runGit } from '../lib/github.mjs';
import { inspectTaskMaterial } from '../lib/coordinator.mjs';

// Independent Git reference: pipe the full binary patch without buffering it.
async function binaryPatchId(cwd, base, head) {
  const diff=spawn('git',['diff','--binary',base,head],{cwd,stdio:['ignore','pipe','pipe']});
  const reader=spawn('git',['patch-id','--stable'],{cwd,stdio:['pipe','pipe','pipe']});
  const closed=child=>new Promise((resolve,reject)=>{
    child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('Git reference failed: '+code)));
  });
  const done=[closed(diff),closed(reader)];let output='';
  diff.stderr.resume();reader.stderr.resume();reader.stdout.setEncoding('utf8');reader.stdout.on('data',s=>output+=s);
  await Promise.all([...done,pipeline(diff.stdout,reader.stdin)]);
  return output.trim().split(/\s/)[0];
}

test('#1280 material identity handles a binary addition above the Git output buffer without losing blob identity',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'hp-material-'));
  const git=async args=>(await runGit(args,{cwd})).stdout.trim();
  try{
    await git(['init','--quiet']);await git(['config','user.name','Fixture']);await git(['config','user.email','fixture@example.test']);
    await git(['config','core.autocrlf','false']);
    await writeFile(join(cwd,'README.md'),'Before\n');await git(['add','.']);await git(['commit','--quiet','-m','Base']);
    const base=await git(['rev-parse','HEAD']);
    const bytes=randomBytes(17*1024*1024);bytes[0]=0;
    await writeFile(join(cwd,'large.bin'),bytes);await writeFile(join(cwd,'README.md'),'After\n');
    await git(['add','.']);await git(['commit','--quiet','-m','Large binary and text']);
    const head=await git(['rev-parse','HEAD']),adapter=new GitAdapter({cwd});
    await assert.rejects(runGit(['diff','--binary',base,head],{cwd}),error=>error.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
    const first=await inspectTaskMaterial(adapter,base,head);
    assert.equal(first.patchId,await binaryPatchId(cwd,base,head),'same identity as the full binary Git representation');
    assert.deepEqual(first.changedFiles,['README.md','large.bin']);assert.equal(first.layer,'infra');
    assert.equal(first.expectedBase,base);assert.equal(first.materialSha,head);
    bytes[32]^=1;await writeFile(join(cwd,'large.bin'),bytes);await git(['add','.']);await git(['commit','--quiet','-m','Same size, changed bytes']);
    const changed=await git(['rev-parse','HEAD']),second=await inspectTaskMaterial(adapter,base,changed);
    assert.notEqual(second.patchId,first.patchId,'same-length binary changes invalidate the reviewed material');
    assert.equal(second.patchId,await binaryPatchId(cwd,base,changed));
    await assert.rejects(inspectTaskMaterial(adapter,changed,base),'non-ancestor input remains refused');
  }finally{await rm(cwd,{recursive:true,force:true});}
});
