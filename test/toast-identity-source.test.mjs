import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {missingToastIdentities} from '../scripts/toast-identity-source.mjs';

test('#1011 every known translated toast call and forwarding adapter carries identity', () => {
  const root=fileURLToPath(new URL('../src/',import.meta.url));
  const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()
    ?walk(join(dir,entry.name)):entry.name.endsWith('.ts')?[join(dir,entry.name)]:[]);
  assert.deepEqual(walk(root).flatMap(path=>missingToastIdentities(readFileSync(path,'utf8'),relative(root,path))),[]);
});

test('#1011 ordinary negative inputs expose literals, helper keys, branches, aliases and forwarding loss', () => {
  for(const source of [
    "host._showToast(host._t('toast.failure'));",
    "host._showToast(inboxT(host,'device_inbox.selection_changed'));",
    "host._showToast(host._t(ok?'toast.ok':'toast.failure'),'toast.ok');",
    "host._showToast(ok?host._t('toast.ok'):host._t('toast.failure'),'message');",
    "const message=supportT(lang,key); host._showToast(message);",
    "port.toast(port.text(key));",
    "const toast=(message:string)=>host._showToast(message);",
    "const port={toast:(message,id)=>host._showToast(message)};",
  ]) assert.equal(missingToastIdentities(source).length,1,source);
});

test('#1011 key expressions survive helper/conditional/type-wrapper and adapter boundaries', () => {
  for(const source of [
    "host._showToast(inboxT(host,'device_inbox.selection_changed'),'device_inbox.selection_changed');",
    "host._showToast(host._t(ok?'toast.ok':'toast.failure'),ok?'toast.ok':'toast.failure');",
    "host._showToast(ok?host._t('toast.ok'):external,ok?'toast.ok':'message');",
    "const message=supportT(lang,key); host._showToast(message,key);",
    "port.toast(port.text(key as I18nKey),key);",
    "const toast=(message:string,id?:string)=>host._showToast(message,id);",
    "const port={showToast:(message,id)=>host._showToast(message,id)};",
    "function other(message){host._showToast(message)}",
  ]) assert.deepEqual(missingToastIdentities(source),[],source);
});

test('#1011 external/composed text uses message without reverse lookup', () => {
  for(const source of [
    "host._showToast(external.message);", "host._showToast('external');",
    "host._showToast(host._t('pdf.failed')+' '+advice);",
    "host._showToast(`${host._t('a')} ${host._t('b')}`);",
  ]) assert.deepEqual(missingToastIdentities(source),[],source);
});
