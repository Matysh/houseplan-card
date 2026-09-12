// #514: release.yml holds the assets of a stable release until E2E on a real HA is green.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
const at = (marker) => { const i = workflow.indexOf(marker); assert.ok(i > 0, `нет «${marker}»`); return i; };

test('#514 AC1/AC3: the E2E gate step exists in job gate, after Full Performance, for stable releases only', () => {
  const gate = at('  gate:\n');
  const build = at('  build:\n');
  const perf = at('      - name: Require full performance for a stable release\n');
  const e2e = at('      - name: Require green E2E on a real Home Assistant for a stable release\n');
  assert.ok(gate < perf && perf < e2e && e2e < build, 'E2E stands after Full Performance inside job gate');
  const step = workflow.slice(e2e, build);
  assert.match(step, /if: \$\{\{ !github\.event\.release\.prerelease \}\}/, 'prereleases skip the step');
  assert.match(step, /node scripts\/e2e-gate\.mjs --tag="\$TAG"/);
  assert.match(step, /TAG: \$\{\{ github\.event\.release\.tag_name \}\}/);
});

test('#514: the gate dispatches with a token that can reach houseplan-e2e, with the process token as fallback', () => {
  const e2e = at('      - name: Require green E2E on a real Home Assistant for a stable release\n');
  const step = workflow.slice(e2e, at('  build:\n'));
  assert.match(step, /GH_TOKEN: \$\{\{ secrets\.E2E_DISPATCH_TOKEN \|\| secrets\.HP_PROCESS_TOKEN \}\}/);
});

// #538: анонс — последнее звено выпуска, а не параллельное ему. Пока он висел
// на самом событии `release: published`, гонку он выигрывал всегда: проверять
// ему нечего. 12.09 v1.75.0 объявили в канале в ту же минуту, когда гейт
// отказал выкладывать ассеты, и снаружи это выглядело обычным релизом.
const announce = readFileSync(new URL('../.github/workflows/announce.yml', import.meta.url), 'utf8');

test('#538 AC1: событие релиза не может запустить анонс', () => {
  const triggers = announce.slice(announce.indexOf('\non:'), announce.indexOf('\npermissions:'));
  assert.ok(!/^\s*release:/m.test(triggers), 'в триггерах анонса нет `release:`');
  assert.match(triggers, /^\s*workflow_dispatch:/m, 'кнопка проверки связи остаётся');
  assert.match(triggers, /^\s*workflow_call:/m, 'вызов из воркфлоу остаётся');
  assert.ok(!/github\.event\.release\./.test(announce),
    'мёртвая ветка события не оставлена в шагах');
});

test('#538 AC2: release.yml зовёт анонс после выкладки ассетов', () => {
  const job = at('  announce:\n');
  const build = at('  build:\n');
  assert.ok(build < job, 'анонс описан после сборки, а не до неё');
  const block = workflow.slice(job, workflow.indexOf('\n  hacs-discovery:'));
  assert.match(block, /needs: build/, 'анонс зависит от выкладки ассетов');
  assert.match(block, /uses: \.\/\.github\/workflows\/announce\.yml/);
  assert.match(block, /prerelease: \$\{\{ github\.event\.release\.prerelease \}\}/,
    'беты остаются тихими по тому же признаку, что и раньше');
  assert.match(block, /secrets: inherit/);
});
