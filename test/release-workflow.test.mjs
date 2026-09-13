// #514: release.yml holds the assets of a stable release until E2E on a real HA is green.
// #540: release.yml is the ONLY publisher of installable assets, and it publishes
// only after the gates saw the very same bytes.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WORKFLOWS = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
const read = (name) => readFileSync(new URL(name, `file://${WORKFLOWS}`), 'utf8');
const workflow = read('release.yml');
const at = (marker, text = workflow) => { const i = text.indexOf(marker); assert.ok(i > 0, `нет «${marker}»`); return i; };
const job = (name) => {
  const start = at(`\n  ${name}:\n`);
  const rest = workflow.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};
const jobNeeds = (name) => {
  const m = /^ {4}needs: (.+)$/m.exec(job(name));
  if (!m) return [];
  return m[1].replace(/[[\]\s]/g, '').split(',').filter(Boolean);
};

test('#540 AC1: exactly one workflow reacts to the release event, and none of them publishes on it', () => {
  const listeners = readdirSync(WORKFLOWS).filter((name) => name.endsWith('.yml'))
    .filter((name) => /^\s*release:\s*\n\s+types:/m.test(read(name).slice(0, read(name).indexOf('\njobs:'))));
  assert.deepEqual(listeners, ['release.yml'], 'release-zip.yml (immediate ZIP upload) is gone and must not come back');
  assert.ok(!readdirSync(WORKFLOWS).includes('release-zip.yml'));
  // asset uploads live only in the job that needs the gate
  const jobs = [...workflow.slice(at('\njobs:\n')).matchAll(/^ {2}([a-z-]+):\n/gm)].map((m) => m[1]);
  assert.deepEqual(jobs, ['candidate', 'gate', 'stage', 'publish', 'announce', 'hacs-discovery']);
  const uploads = jobs.filter((name) => /gh release upload|softprops\/action-gh-release/.test(job(name)));
  assert.deepEqual(uploads, ['stage'], 'the one uploading job');
  assert.deepEqual(jobNeeds('stage'), ['candidate', 'gate']);
  assert.deepEqual(jobNeeds('publish'), ['candidate', 'gate', 'stage']);
});

test('#540 AC2: a release published by hand is taken back to draft before any gate runs', () => {
  const candidate = job('candidate');
  assert.match(candidate, /gh release edit "\$TAG" --repo "\$GITHUB_REPOSITORY" --draft\n/, 'fail-closed re-draft');
  assert.ok(at('--draft\n', candidate) < at('\n  gate:\n'), 're-draft is in the candidate job, ahead of the gate');
  assert.match(candidate, /if \[ "\$EVENT" = "release" \]; then/, 'only a hand-made publication is re-drafted');
  assert.match(candidate, /echo "mode=repair"/, 'a dispatch on a public release is a repair, not a re-publication');
  assert.match(candidate, /if: \$\{\{ github\.event_name == 'workflow_dispatch' \|\| !github\.event\.release\.prerelease \}\}/,
    'betas published by hand are skipped: they have their own staged path');
  const triggers = workflow.slice(at('\non:\n'), at('\npermissions:'));
  assert.match(triggers, /release:\n\s+types: \[published\]/, '`created` never fires for drafts — `published` catches both paths');
  assert.match(triggers, /workflow_dispatch:\n\s+inputs:\n\s+tag:/);
});

test('#540 AC1/#514: the gate judges the exact SHA — trailer names the tag, contract, Validate, Full Performance, E2E on the SHA', () => {
  const gate = job('gate');
  const trailer = at('grep -Fxq "Release: $TAG"', gate);
  const contract = at('node scripts/release-contract.mjs "$TAG" --repo="$GITHUB_REPOSITORY" --stable', gate);
  const validate = at('node scripts/release-gate.mjs "$SHA"\n', gate);
  const perf = at('      - name: Require full performance for a stable release\n', gate);
  const e2e = at('      - name: Require green E2E on a real Home Assistant for a stable release\n', gate);
  assert.ok(trailer < contract && contract < validate && validate < perf && perf < e2e, 'order: trailer, contract, Validate, Full Performance, E2E');
  const e2eStep = gate.slice(e2e);
  assert.match(e2eStep, /if: \$\{\{ needs\.candidate\.outputs\.prerelease != 'true' \}\}/, 'prereleases skip the step');
  assert.match(e2eStep, /node scripts\/e2e-gate\.mjs --ref="\$SHA" --tag="\$TAG"/, 'E2E installs the candidate tree, not a public ZIP');
  assert.match(e2eStep, /GH_TOKEN: \$\{\{ secrets\.E2E_DISPATCH_TOKEN \|\| secrets\.HP_PROCESS_TOKEN \}\}/);
  assert.match(gate, /--workflow=performance\.yml --label="Полные бенчмарки производительности"/);
  assert.ok(!/github\.event\.release\.tag_name/.test(gate + job('stage') + job('publish')), 'every job works from the resolved candidate, not the event payload');
});

test('#540 AC3: one build, deterministic ZIP from the tree E2E installed, passport, verified public bytes', () => {
  const stage = job('stage');
  assert.match(stage, /git -c core\.autocrlf=false archive --format=zip --output=houseplan\.zip \\\n\s+"\$SHA:custom_components\/houseplan"/);
  assert.match(stage, /node scripts\/verify-houseplan-zip\.mjs houseplan\.zip/);
  assert.match(stage, /git rev-parse "\$SHA:custom_components\/houseplan"/, 'tree hash printed: identity with the E2E tarball');
  assert.match(stage, /node scripts\/release-assets\.mjs sums release-assets/);
  assert.match(stage, /test -s dist\/houseplan-panel\.js/);
  assert.ok(at('node scripts/release-assets.mjs sums', stage) < at('gh release upload', stage), 'passport before upload');
  // repair: only missing assets, a differing hash is a failure
  assert.match(stage, /if \[ "\$MODE" = "repair" \]; then/);
  assert.match(stage, /node scripts\/release-assets\.mjs check public release-assets\/SHA256SUMS --allow-missing/);
  const repair = stage.slice(at('if [ "$MODE" = "repair" ]', stage), at('          else\n            # Draft', stage));
  const repairCommands = repair.split('\n').filter((line) => !/^\s*#/.test(line) && !/gh release download/.test(line)).join('\n');
  assert.ok(!/--clobber/.test(repairCommands), 'repair never clobbers a public asset');
  assert.match(repair, /gh release upload "\$TAG" \$missing --repo "\$GITHUB_REPOSITORY"\n/);

  const publish = job('publish');
  assert.ok(at('--draft=false', publish) < at('gh release download', publish), 'publish, then read back what the public sees');
  assert.match(publish, /diff -u passport\/SHA256SUMS public\/SHA256SUMS/);
  assert.match(publish, /node scripts\/release-assets\.mjs check public passport\/SHA256SUMS\n/);
  assert.match(publish, /test "\$\(git rev-list -n 1 "refs\/tags\/\$TAG"\)" = "\$SHA"/);
  assert.match(publish, /download-artifact@v7/, 'the passport travels from stage as an artifact, not via the release');
});

// #538: анонс — последнее звено выпуска, а не параллельное ему. Пока он висел
// на самом событии `release: published`, гонку он выигрывал всегда: проверять
// ему нечего. 12.09 v1.75.0 объявили в канале в ту же минуту, когда гейт
// отказал выкладывать ассеты, и снаружи это выглядело обычным релизом.
const announce = read('announce.yml');

test('#538 AC1: событие релиза не может запустить анонс', () => {
  const triggers = announce.slice(announce.indexOf('\non:'), announce.indexOf('\npermissions:'));
  assert.ok(!/^\s*release:/m.test(triggers), 'в триггерах анонса нет `release:`');
  assert.match(triggers, /^\s*workflow_dispatch:/m, 'кнопка проверки связи остаётся');
  assert.match(triggers, /^\s*workflow_call:/m, 'вызов из воркфлоу остаётся');
  assert.ok(!/github\.event\.release\./.test(announce),
    'мёртвая ветка события не оставлена в шагах');
});

test('#538 AC2 / #540: release.yml зовёт анонс только после публикации проверенных ассетов', () => {
  const block = job('announce');
  assert.ok(at('\n  publish:\n') < at('\n  announce:\n'), 'анонс описан после публикации, а не до неё');
  // Не `/needs: publish/`: в том же блоке лежит комментарий, где эта строка
  // процитирована, и проверка зеленела бы на нём. Требуется сама директива.
  assert.match(block, /^ {4}needs: \[candidate, publish\]$/m, 'анонс зависит от публикации');
  assert.match(block, /if: \$\{\{ needs\.publish\.outputs\.newly_published == 'true' \}\}/, 'ремонт не анонсируется');
  assert.match(block, /uses: \.\/\.github\/workflows\/announce\.yml/);
  assert.match(block, /prerelease: \$\{\{ needs\.candidate\.outputs\.prerelease == 'true' \}\}/,
    'беты остаются тихими по признаку тега');
  assert.match(block, /secrets: inherit/);
});
