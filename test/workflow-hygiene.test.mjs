// #658: гигиена обвязки CI, которую иначе ломает время, а не правка.
//
// 1. Образ раннера закреплён. `ubuntu-latest` с 19.10.2026 переезжает на
//    Ubuntu 26 (actions/runner-images#14748), а golden-эталоны, скриншоты
//    документации и перф-бюджеты сняты на текущем образе с пинами
//    Playwright/Chromium (#455, #557): смена образа «под ногами» дала бы
//    массовый `different` и красный перф без единой правки. Образ один на все
//    workflow и поднимается осознанно — docs/DEVELOPMENT.md, «Moving the
//    runner image».
// 2. У каждой job на раннере свой timeout-minutes: по умолчанию GitHub держит
//    зависшую job 360 минут и занимает раннер, нужный очереди ревью.
// 3. Расписания не на круглых минутах: старты «ровно в час» GitHub сдвигает
//    на часы (ночь с планом 02:30 стартовала в 07:42–08:05).

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseJobSettings } from '../scripts/workflow-jobs.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';

const WORKFLOWS = new URL('../.github/workflows/', import.meta.url);
const files = readdirSync(WORKFLOWS).filter((name) => name.endsWith('.yml')).sort();
const textOf = (name) => readFileSync(new URL(name, WORKFLOWS), 'utf8');
const runnerJobs = files.flatMap((file) => [...parseJobSettings(textOf(file), file).values()]
  .filter((job) => !job.uses)
  .map((job) => ({ ...job, file })));

test('#658: разбор job-ключей видит каждый workflow и отличает вызов тела от job на раннере', () => {
  assert.ok(files.length >= 10, `workflow найдено: ${files.length}`);
  assert.ok(runnerJobs.length >= 40, `job на раннере: ${runnerJobs.length}`);
  const jobs = parseJobSettings([
    'jobs:',
    '  body:',
    '    uses: owner/repo/.github/workflows/_x.yml@dev # тело',
    '  work:',
    '    name: Работа',
    "    runs-on: 'ubuntu-24.04' # образ",
    '    timeout-minutes: 12',
    '    strategy:',
    '      matrix:',
    '        profile:',
    '          - a',
    '    steps:',
    '      - run: echo "runs-on: ubuntu-latest"',
  ].join('\n'), 'fixture');
  assert.deepEqual(jobs.get('body'), { id: 'body', runsOn: null, timeoutMinutes: null, uses: 'owner/repo/.github/workflows/_x.yml@dev' });
  assert.deepEqual(jobs.get('work'), { id: 'work', runsOn: 'ubuntu-24.04', timeoutMinutes: 12, uses: null });
  assert.throws(() => parseJobSettings('jobs:\n  a:\n    timeout-minutes: ${{ inputs.t }}\n', 'fixture'),
    /timeout-minutes must be a literal integer/);
});

test('#658: образ раннера закреплён явной версией и один на все workflow', () => {
  const floating = runnerJobs.filter((job) => !/^ubuntu-\d{2}\.\d{2}$/.test(job.runsOn ?? ''));
  assert.deepEqual(floating.map((job) => `${job.file}:${job.id} runs-on=${job.runsOn}`), [],
    'плавающая метка (ubuntu-latest) или не-Linux образ: смена образа под ногами = массовый golden different');
  const images = [...new Set(runnerJobs.map((job) => job.runsOn))];
  assert.equal(images.length, 1, `образы разошлись: ${images.join(', ')} — поднимайте образ во всех workflow разом`);
  const development = readFileSync(new URL('../docs/DEVELOPMENT.md', import.meta.url), 'utf8');
  assert.match(development, /^## Moving the runner image \(#658\)$/m, 'порядок подъёма образа записан');
});

test('#658: у каждой job на раннере есть timeout-minutes, и он не выше трёх часов', () => {
  const missing = runnerJobs.filter((job) => job.timeoutMinutes === null);
  assert.deepEqual(missing.map((job) => `${job.file}:${job.id}`), [],
    'без timeout-minutes GitHub держит зависшую job 360 минут');
  const outOfRange = runnerJobs.filter((job) => job.timeoutMinutes < 1 || job.timeoutMinutes > 180);
  assert.deepEqual(outOfRange.map((job) => `${job.file}:${job.id}=${job.timeoutMinutes}`), []);
});

test('#658: расписания cron не стоят на круглых минутах', () => {
  const schedules = files.flatMap((file) => [...textOf(file).matchAll(/^\s*- cron:\s*['"]([^'"]+)['"]/gm)]
    .map((match) => ({ file, cron: match[1] })));
  assert.ok(schedules.length >= 5, `расписаний найдено: ${schedules.length}`);
  const round = schedules.filter(({ cron }) => cron.split(/\s+/)[0].split(',')
    .some((minute) => !/^\d+$/.test(minute) || Number(minute) % 15 === 0));
  assert.deepEqual(round.map(({ file, cron }) => `${file}: ${cron}`), [],
    'минута 0/15/30/45 или шаблон — очередь «ровных» расписаний GitHub');
});

// Шаг исполняется настоящим bash по тексту из workflow: проверяется то, что
// запустит раннер, а не пересказ логики.
const lagStep = () => {
  const lines = textOf('_nightly.yml').split('\n');
  const nameAt = lines.findIndex((line) => line.includes('name: "Сдвиг старта ночи против расписания"'));
  assert.ok(nameAt >= 0, 'шаг сдвига старта есть в _nightly.yml');
  const runAt = lines.findIndex((line, i) => i > nameAt && /^\s+run: \|\s*$/.test(line));
  const runIndent = lines[runAt].length - lines[runAt].trimStart().length;
  const body = [];
  for (let i = runAt + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() && line.length - line.trimStart().length <= runIndent) break;
    body.push(line.slice(runIndent + 2));
  }
  return body.join('\n');
};

test('#658: шаг сдвига старта ночи предупреждает при сдвиге больше часа', { skip: process.platform === 'win32' && 'нужен GNU bash и date' }, () => {
  const script = lagStep();
  // #766: shell шага — по правилам раннера (без `shell:` — `bash -e {0}`, а не голый bash).
  const step = findStep(textOf('_nightly.yml'), { name: 'Сдвиг старта ночи против расписания' }, '_nightly.yml');
  const dir = mkdtempSync(join(tmpdir(), 'hp-658-lag-'));
  try {
    const run = (schedule, nowIso) => {
      const summary = join(dir, `summary-${nowIso.replace(/\W/g, '')}.md`);
      const result = runStep(step, script, {
        encoding: 'utf8',
        env: { ...process.env, SCHEDULE: schedule, NOW_EPOCH: String(Date.parse(nowIso) / 1000), GITHUB_STEP_SUMMARY: summary },
      });
      assert.equal(result.status, 0, result.stderr);
      return { out: result.stdout, summary: readFileSync(summary, 'utf8') };
    };
    const late = run('17 2 * * *', '2026-09-27T07:47:00Z');
    assert.match(late.summary, /сдвиг 330 мин/);
    assert.match(late.out, /^::warning::ночной прогон стартовал на 330 мин позже/m);
    const onTime = run('17 2 * * *', '2026-09-27T02:40:00Z');
    assert.match(onTime.summary, /сдвиг 23 мин/);
    assert.doesNotMatch(onTime.out, /::warning::/);
    assert.doesNotMatch(run('17 2 * * *', '2026-09-27T03:17:00Z').out, /::warning::/, 'ровно 60 мин — ещё не предупреждение');
    assert.match(run('17 2 * * *', '2026-09-27T03:18:00Z').out, /::warning::/, '61 мин — уже предупреждение');
    const pastMidnight = run('50 23 * * *', '2026-09-28T00:10:00Z');
    assert.match(pastMidnight.summary, /сдвиг 20 мин/, 'план вчерашнего вечера, старт после полуночи');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
