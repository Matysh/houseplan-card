import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CAPTURE_PROVENANCE_SCHEMA, captureProvenance, reportCaptureProvenance,
} from '../scripts/capture-environment.mjs';
import { GOLDEN_INDEX_SCHEMA, indexCapturedOn } from '../demo/golden/policy.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';

// #571. Отчёт съёмки не нёс платформу, и приёмщик записывал в индекс СВОЮ:
// артефакт Linux-прогона 34853080375, принятый на Windows, дал на `ad4000f9`
// запись `"platform": "win32"` у кадров, которых Windows не снимала. Причина
// осознанного обхода при этом жила только в stdout.
//
// Проверки гоняют НАСТОЯЩИЙ `accept.mjs` в отдельном каталоге эталонов: писать
// в рабочий репозиторий тест не имеет права, а подменять модуль — значит
// проверять не то, что исполняется на приёмке.

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const BASELINES = resolve(ROOT, 'demo/golden/baselines');

/** Артефакт съёмки: кадры равны принятым эталонам, отчёт — с нужным провенансом. */
function fixture({ platform = 'linux', schema = CAPTURE_PROVENANCE_SCHEMA, capture = undefined } = {}) {
  const dir = mkdtempSync(resolve(tmpdir(), 'hp-golden-571-'));
  mkdirSync(resolve(dir, 'actual'), { recursive: true });
  const index = JSON.parse(readFileSync(resolve(BASELINES, 'baselines-index.json'), 'utf8'));
  const results = GOLDEN_SCENARIOS.map((scenario) => {
    const source = resolve(BASELINES, `${scenario.id}.png`);
    const actual = resolve(dir, 'actual', `${scenario.id}.png`);
    copyFileSync(source, actual);
    const sha = createHash('sha256').update(readFileSync(actual)).digest('hex');
    return { id: scenario.id, status: 'passed', actualSha256: sha, baselineSha256: sha, diffRatio: 0 };
  });
  const report = {
    schema,
    mode: 'verify',
    generatedAt: new Date().toISOString(),
    matrixVersion: GOLDEN_MATRIX_VERSION,
    buildFingerprint: sourceFingerprint(ROOT),
    chromium: index.chromium,
    results,
  };
  if (schema >= CAPTURE_PROVENANCE_SCHEMA) {
    report.capture = capture === undefined
      ? { ...captureProvenance({ chromium: index.chromium, buildFingerprint: report.buildFingerprint, env: {} }), platform }
      : capture;
  }
  writeFileSync(resolve(dir, 'golden-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return dir;
}

/** Приёмка в изолированный каталог эталонов: рабочий репозиторий не трогаем. */
function accept(from, { reason = '', expectFailure = false } = {}) {
  const sandbox = mkdtempSync(resolve(tmpdir(), 'hp-golden-571-baselines-'));
  execFileSync('cp', ['-r', BASELINES + '/.', sandbox]);
  const env = { ...process.env };
  if (reason) env.HP_ALLOW_FOREIGN_CAPTURE = reason; else delete env.HP_ALLOW_FOREIGN_CAPTURE;
  try {
    const stdout = execFileSync(process.execPath,
      [resolve(ROOT, 'demo/golden/accept.mjs'), '--reviewed', `--from=${from}`, `--baselines=${sandbox}`],
      { cwd: ROOT, env, encoding: 'utf8' });
    if (expectFailure) throw new Error('приёмка обязана была отказать, а прошла');
    return { stdout, index: JSON.parse(readFileSync(resolve(sandbox, 'baselines-index.json'), 'utf8')), sandbox };
  } catch (error) {
    if (!expectFailure) throw error;
    return {
      error: String(error.stderr || error.message),
      index: JSON.parse(readFileSync(resolve(sandbox, 'baselines-index.json'), 'utf8')),
      sandbox,
    };
  }
}

test('#571 AC1: артефакт Linux принимается, обе стороны провенанса записаны', () => {
  const from = fixture({ platform: 'linux' });
  const { index } = accept(from);
  assert.equal(index.schema, GOLDEN_INDEX_SCHEMA);
  assert.equal(index.capturedOn, 'linux', 'платформа КАДРОВ — из отчёта');
  assert.equal(index.acceptedOn, process.platform, 'платформа приёмки — своя');
  assert.equal(indexCapturedOn(index), 'linux');
  assert.equal(index.capture.chromium, index.chromium);
  assert.equal(index.foreignCapture, null, 'канон обхода не требует');
  rmSync(from, { recursive: true, force: true });
});

test('#571 AC2: чужая среда съёмки без причины — отказ до записи', () => {
  const from = fixture({ platform: 'win32' });
  const before = readFileSync(resolve(BASELINES, 'baselines-index.json'), 'utf8');
  const { error, index } = accept(from, { expectFailure: true });
  assert.match(error, /приёмка отказана/);
  assert.match(error, /win32/);
  assert.equal(index.capturedOn ?? null, JSON.parse(before).capturedOn ?? null,
    'индекс обязан остаться нетронутым: отказ до записи');
  rmSync(from, { recursive: true, force: true });
});

test('#571 AC1: чужая среда съёмки с причиной — причина уезжает в индекс', () => {
  const from = fixture({ platform: 'win32' });
  const reason = 'аудит #571: проверяю ветку осознанного обхода';
  const { index, stdout } = accept(from, { reason });
  assert.equal(index.capturedOn, 'win32');
  assert.equal(index.acceptedOn, process.platform);
  assert.deepEqual(index.foreignCapture, { reason });
  assert.match(stdout, /Чужая среда разрешена осознанно/);
  rmSync(from, { recursive: true, force: true });
});

test('#571 схема 2 fail-closed: раздел capture обязателен', () => {
  assert.throws(() => reportCaptureProvenance({ schema: 2 }), /обязан нести раздел capture/);
  assert.throws(() => reportCaptureProvenance({ schema: 2, capture: { arch: 'x64' } }), /не называет платформу/);
  const from = fixture({ capture: { arch: 'x64', chromium: '1' } });
  const { error } = accept(from, { expectFailure: true });
  assert.match(error, /не называет платформу съёмки/);
  rmSync(from, { recursive: true, force: true });
});

test('#571 старая схема — отдельная явная ветка, а не подстановка своей платформы', () => {
  assert.deepEqual(reportCaptureProvenance({ schema: 1 }), { provenance: null, legacy: true });
  const from = fixture({ schema: 1 });
  const { index, stdout } = accept(from);
  assert.equal(index.capturedOn, null, 'выдумывать платформу кадров нельзя');
  assert.equal(index.acceptedOn, process.platform);
  assert.match(stdout, /Отчёт старой схемы/);
  rmSync(from, { recursive: true, force: true });
});

test('#571 индекс любой схемы читается одним правилом', () => {
  assert.equal(indexCapturedOn({ schema: 1, platform: 'linux' }), 'linux', 'схема 1: platform — это кадры');
  assert.equal(indexCapturedOn({ schema: 2, capturedOn: 'linux', acceptedOn: 'win32' }), 'linux');
  assert.equal(indexCapturedOn({ schema: 2, acceptedOn: 'win32' }), null, 'схема 2 без capturedOn ничего не обещает');
  assert.equal(indexCapturedOn(null), null);
});

test('#571 подмена PNG и неполный артефакт по-прежнему fail-closed', () => {
  const tampered = fixture();
  const victim = resolve(tampered, 'actual', `${GOLDEN_SCENARIOS[0].id}.png`);
  writeFileSync(victim, Buffer.concat([readFileSync(victim), Buffer.from([0])]));
  assert.match(accept(tampered, { expectFailure: true }).error, /candidate changed after capture/);
  rmSync(tampered, { recursive: true, force: true });

  const incomplete = fixture();
  rmSync(resolve(incomplete, 'actual', `${GOLDEN_SCENARIOS[1].id}.png`));
  assert.match(accept(incomplete, { expectFailure: true }).error, /review candidate missing/);
  rmSync(incomplete, { recursive: true, force: true });
});
