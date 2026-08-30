import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_CANDIDATES, baseSummary, greenShas, judgedShas, pickBase, pickRangeBase,
} from '../scripts/classify-base.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/classify-base.mjs', import.meta.url));

test('зелёными считаются только успешно завершённые прогоны (#387)', () => {
  const green = greenShas({
    workflow_runs: [
      { head_sha: 'aaa', conclusion: 'success' },
      // Ровно тот случай, из-за которого заведён #387: прогон предыдущего
      // пуша отменён следующим пушем.
      { head_sha: 'bbb', conclusion: 'cancelled' },
      { head_sha: 'ccc', conclusion: 'failure' },
      { head_sha: 'ddd', conclusion: null, status: 'in_progress' },
      { head_sha: 'eee', conclusion: 'skipped' },
    ],
  });
  assert.deepEqual([...green], ['aaa']);
});

test('недоступный или битый ответ API даёт пустой список, а не падение (#387)', () => {
  for (const payload of [null, undefined, {}, { workflow_runs: null }, 'мусор', 42]) {
    assert.equal(greenShas(payload).size, 0, `${JSON.stringify(payload)}`);
  }
});

test('база — самый новый зелёный предок (#387)', () => {
  const choice = pickBase({
    candidates: ['c3', 'c2', 'c1'],
    green: new Set(['c2', 'c1']),
    mergeBase: 'mb',
  });
  assert.equal(choice.base, 'c2', 'из двух зелёных берётся более новый');
  assert.equal(choice.proven, true);
  assert.equal(choice.skipped, 1);
});

test('цепочка отменённых прогонов расширяет диапазон до merge-base (#387)', () => {
  // Сценарий #86 r5: у предыдущего пуша прогон cancelled, зелёных предков нет.
  const choice = pickBase({ candidates: ['fa146fb1', '04da7eb1'], green: new Set(), mergeBase: 'mb' });
  assert.equal(choice.base, 'mb');
  assert.equal(choice.proven, false);
  assert.match(baseSummary(choice, { head: 'head1234', mergeBase: 'mb345678' }).join('\n'),
    /расширен до/);
});

test('ветка без собственных коммитов не ломает выбор (#387)', () => {
  const choice = pickBase({ candidates: [], green: new Set(['x']), mergeBase: 'mb' });
  assert.equal(choice.base, 'mb');
  assert.equal(choice.skipped, 0);
});

test('обход кандидатов ограничен сверху (#387)', () => {
  const many = Array.from({ length: MAX_CANDIDATES + 5 }, (_, i) => `c${i}`);
  // Зелёный есть, но лежит за пределом обхода: ответ обязан быть безопасным,
  // то есть более широким, а не «ничего не нашли — берём последний».
  const choice = pickBase({ candidates: many, green: new Set([`c${MAX_CANDIDATES + 2}`]), mergeBase: 'mb' });
  assert.equal(choice.base, 'mb');
});

test('CLI считает базу по настоящей истории git (#387)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-classify-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    const commit = (text) => {
      writeFileSync(join(dir, 'file.txt'), text);
      git('add', '-A');
      git('commit', '-qm', text);
      return git('rev-parse', 'HEAD');
    };
    const root = commit('root');
    const green = commit('проверенный');
    const cancelled = commit('прогон отменён');
    const head = commit('текущий пуш');

    const runsFile = join(dir, 'runs.json');
    const out = join(dir, 'out.txt');
    const run = (runs) => {
      writeFileSync(runsFile, JSON.stringify(runs));
      writeFileSync(out, '');
      const result = spawnSync(process.execPath, [
        SCRIPT, `--head=${head}`, `--merge-base=${root}`, `--runs=${runsFile}`,
      ], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
      assert.equal(result.status, 0, result.stderr);
      return { stdout: result.stdout, output: readFileSync(out, 'utf8') };
    };

    const withGreen = run({
      workflow_runs: [
        { head_sha: green, conclusion: 'success' },
        { head_sha: cancelled, conclusion: 'cancelled' },
        // HEAD в списке зелёных быть не может, но даже если API его вернёт,
        // сам себя коммит проверенным не объявляет.
        { head_sha: head, conclusion: 'success' },
      ],
    });
    assert.match(withGreen.output, new RegExp(`base=${green}\\n`));
    assert.match(withGreen.output, /proven=true/);

    const noGreen = run({ workflow_runs: [{ head_sha: cancelled, conclusion: 'cancelled' }] });
    assert.match(noGreen.output, new RegExp(`base=${root}\\n`));
    assert.match(noGreen.output, /proven=false/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- база гейтов диапазона (#388) ------------------------------------------

test('гейты диапазона берут тот же зелёный предок (#388)', () => {
  const choice = pickRangeBase({
    candidates: ['отменён2', 'отменён1', 'зелёный'],
    green: new Set(['зелёный']),
    fallback: 'before',
  });
  assert.equal(choice.base, 'зелёный');
  assert.equal(choice.proven, true);
  // Ровно те два коммита, которые до #388 не судил никто.
  assert.equal(choice.skipped, 2);
});

test('без зелёного предка база остаётся прежней, но помечается недоказанной (#388)', () => {
  // Расширять диапазон здесь нельзя: гейт, который сам красит прогон, лишил бы
  // следующий пуш зелёного предка и запер dev в красноте навсегда. Фолбэк
  // обязан не зависеть от собственного успеха гейта.
  const choice = pickRangeBase({ candidates: ['a', 'b'], green: new Set(), fallback: 'before' });
  assert.equal(choice.base, 'before');
  assert.equal(choice.proven, false);
  const summary = baseSummary(choice, { head: 'head1234', mergeBase: '' }).join('\n');
  assert.match(summary, /НЕ доказательство/);
  assert.match(summary, /могли не пройти ни одного гейта/);
});

test('пустой фолбэк не выдаёт мусор за базу (#388)', () => {
  const choice = pickRangeBase({ candidates: [], green: new Set(), fallback: undefined });
  assert.equal(choice.base, '');
  assert.equal(choice.proven, false);
});

test('CLI режима range считает базу по истории и пишет своё имя выхода (#388)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-range-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  try {
    git('init', '-q', '-b', 'dev');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    const commit = (text) => {
      writeFileSync(join(dir, 'file.txt'), text);
      git('add', '-A');
      git('commit', '-qm', text);
      return git('rev-parse', 'HEAD');
    };
    commit('корень');
    const green = commit('прогон зелёный');
    const cancelled = commit('прогон отменён');
    const head = commit('текущий пуш');
    const runsFile = join(dir, 'runs.json');
    const out = join(dir, 'out.txt');
    writeFileSync(runsFile, JSON.stringify({
      workflow_runs: [
        { head_sha: green, status: 'completed', conclusion: 'success' },
        { head_sha: cancelled, status: 'completed', conclusion: 'cancelled' },
      ],
    }));
    writeFileSync(out, '');
    const result = spawnSync(process.execPath, [
      SCRIPT, `--head=${head}`, '--mode=range', '--name=range_base',
      `--fallback=${cancelled}`, `--runs=${runsFile}`,
    ], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
    assert.equal(result.status, 0, result.stderr);
    const output = readFileSync(out, 'utf8');
    // Имя выхода своё: общее `base` однажды подсунуло бы потребителю чужую базу.
    assert.match(output, new RegExp(`range_base=${green}\\n`));
    assert.match(output, /range_base_proven=true/);
    assert.equal(output.includes('\nbase='), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('судимость и успех — разные предикаты, и путать их дорого (#388)', () => {
  const payload = {
    workflow_runs: [
      { head_sha: 'зелёный', status: 'completed', conclusion: 'success' },
      // Прогон упал по своей причине — backend на dev был красным несколько
      // дней. Коммит при этом СУДИЛИ: вердикт вынесен, автор его видел.
      { head_sha: 'красный', status: 'completed', conclusion: 'failure' },
      // Отменён следующим пушем — вот этот коммит не судил никто.
      { head_sha: 'отменён', status: 'completed', conclusion: 'cancelled' },
      { head_sha: 'идёт', status: 'in_progress', conclusion: null },
    ],
  };
  assert.deepEqual([...greenShas(payload)], ['зелёный'],
    'классификации нужен доказанный успех тяжёлых гейтов (#387)');
  assert.deepEqual([...judgedShas(payload)].sort(), ['зелёный', 'красный'],
    'гейтам диапазона нужен факт суда, а не оправдательный вердикт (#388)');
});

test('красный прогон не переоткрывает уже осуждённые коммиты (#388)', () => {
  // Если бы база уезжала за каждый упавший прогон, гейт предъявлял бы текущему
  // пушу чужой долг — ровно это и уронило dev 30 августа.
  const judged = judgedShas({
    workflow_runs: [{ head_sha: 'предыдущий', status: 'completed', conclusion: 'failure' }],
  });
  const choice = pickRangeBase({
    candidates: ['предыдущий', 'давний'],
    green: judged,
    fallback: 'before',
  });
  assert.equal(choice.base, 'предыдущий');
  assert.equal(choice.skipped, 0);
});
