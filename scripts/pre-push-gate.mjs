#!/usr/bin/env node
/**
 * Локальный набор гейтов перед пушем (#343) и режим хука (#633).
 *
 *   node scripts/pre-push-gate.mjs --hook   # из .githooks/pre-push, строки git на stdin
 *   node scripts/pre-push-gate.mjs
 *   node scripts/pre-push-gate.mjs --base origin/dev --head HEAD
 *   node scripts/pre-push-gate.mjs --no-smokes --no-mutants
 *   node scripts/pre-push-gate.mjs --max-smokes=3 --max-mutants=1
 *
 * Зачем. Красный CI — дорогой способ узнать о проблеме: пять минут ожидания, а
 * при код-ревью ещё и лишний раунд. Прецедент назван в задаче: r2-H1 в #329
 * стоил целого раунда и ловился локальным `npm test`. Здесь то же самое
 * прогоняется одной командой и до пуша.
 *
 * Три правила, без которых такой набор бесполезен.
 *
 * 1. **Он не останавливается на первом упавшем.** Иначе автор узнаёт о втором
 *    нарушении следующим кругом — ровно то, от чего гейт и защищает.
 * 2. **Он громко перечисляет, чего НЕ проверял.** Молчаливый пропуск дважды
 *    стоил проекту дня (#171, #207), а «Verified» без названной команды и её
 *    результата доказательством не является.
 * 3. **Он не претендует на полноту.** Golden, полная матрица смоков и
 *    HA-харнесс — heavy-набор Validate на кандидате; весь мутационный реестр —
 *    ночное расписание (#513); здесь только то, что укладывается в минуты и
 *    ловит 90% возвратов.
 *
 * Режим хука (#633). `.githooks/pre-push` передаёт сюда строки, которые git
 * подаёт хуку, и для каждой ветки `issue/*` решает, гнать ли `npm run gate:small`
 * (`scripts/gate-small.mjs`). По умолчанию — гнать: ошибка, которую набор ловит за
 * минуты, иначе всплывает в Validate и конвейере через полчаса. Не гонится:
 *   · `HP_PREPUSH_GATE=0` — явное выключение (`=1` — наоборот, для любой ветки и
 *     любого диффа);
 *   · ветка не `issue/*` (dev, main, теги, удаление) — там свой контур;
 *   · дифф ветки от merge-base с origin/dev — только класс C/D (документы ревью,
 *     changelog, бандл): набору нечего в нём проверить.
 * Набор проверяет рабочее дерево, поэтому пушиться должен HEAD. Ветка с
 * исполняемым диффом, которая не HEAD, отклоняется — иначе зелёный вердикт был
 * бы вынесен чужому дереву; обход назван в сообщении.
 *
 * Бандл не собирается: `bundle-sync.mjs` раскладывает закоммиченный `dist`, а
 * свежесть проверяет сам продукт — `assertFreshDemoBundle` внутри каждого смока
 * сверяет вшитый отпечаток с исходниками дерева и скажет, если нужна пересборка.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebaseAdvice } from './branch-state.mjs';
import { classify } from './process-gate.mjs';
import { isMainModule, portableCommand } from './spawn-portable.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ZERO_SHA = /^0{40}$/;

// ---- режим хука (#633) ----------------------------------------------------

/** Строки, которые git подаёт pre-push: `<local ref> <local sha> <remote ref> <remote sha>`. */
export function parsePushLines(text) {
  return String(text ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    })
    .filter((ref) => ref.localSha && ref.remoteRef);
}

/** `off` — явно выключен, `force` — для любой ветки и диффа, `default` — ветки issue/*. */
export function gateMode(env = process.env) {
  const raw = String(env.HP_PREPUSH_GATE ?? '').trim().toLowerCase();
  if (['0', 'off', 'false', 'no'].includes(raw)) return 'off';
  if (['1', 'on', 'true', 'yes'].includes(raw)) return 'force';
  return 'default';
}

/** Ветки, которые набор вообще рассматривает: не удаление, не тег, `issue/*` (или любая при force). */
export function candidateRefs(refs, mode) {
  return refs.filter((ref) => !ZERO_SHA.test(ref.localSha)
    && ref.remoteRef.startsWith('refs/heads/')
    && (mode === 'force' || ref.remoteRef.startsWith('refs/heads/issue/')));
}

/** Дифф только из документации и сгенерированного (C/D) — набору нечего проверять. */
export function isDocsOrGeneratedOnly(files) {
  return files.length > 0 && files.every((file) => ['C', 'D'].includes(classify(file)));
}

/**
 * Решение хука. Чистая функция: git передаётся через `mergeBase` и `changedFiles`.
 *
 * @returns {{ action: 'skip' | 'run' | 'reject', reason: string, base?: string, ref?: string }}
 */
export function planHook({ mode, refs, headSha, mergeBase, changedFiles }) {
  if (mode === 'off') return { action: 'skip', reason: 'HP_PREPUSH_GATE=0 — gate:small выключен явно' };
  const candidates = candidateRefs(refs, mode);
  if (!candidates.length) {
    return { action: 'skip', reason: 'в пуше нет веток issue/* — gate:small не требуется (HP_PREPUSH_GATE=1 включит для любой)' };
  }
  const needing = [];
  const notes = [];
  for (const ref of candidates) {
    const base = mergeBase(ref.localSha);
    const files = base ? changedFiles(base, ref.localSha) : null;
    if (mode !== 'force' && files && !files.length) {
      notes.push(`${ref.remoteRef}: диффа от origin/dev нет`);
      continue;
    }
    if (mode !== 'force' && files && isDocsOrGeneratedOnly(files)) {
      notes.push(`${ref.remoteRef}: дифф только класс C/D (${files.length} файл.)`);
      continue;
    }
    needing.push({ ...ref, base: base || 'origin/dev' });
  }
  if (!needing.length) return { action: 'skip', reason: `${notes.join('; ')} — gate:small не требуется` };
  const foreign = needing.filter((ref) => ref.localSha !== headSha);
  if (foreign.length) {
    return {
      action: 'reject',
      reason: `пушится не HEAD: ${foreign.map((ref) => `${ref.localRef} (${ref.localSha.slice(0, 12)})`).join(', ')}.`
        + ' gate:small проверяет рабочее дерево, а оно не совпадает с пушимым коммитом.'
        + ' Переключитесь на ветку и повторите push, либо осознанно: HP_PREPUSH_GATE=0 git push …',
    };
  }
  const [first] = needing;
  return { action: 'run', ref: first.remoteRef, base: first.base, reason: `${first.remoteRef}, база ${first.base.slice(0, 12)}` };
}

/**
 * Окружение набора без переменных git (#633). Хук git запускает с `GIT_DIR`,
 * указывающим на репозиторий, а в `GIT_CONFIG_PARAMETERS` — все `-c` пушащего
 * (включая credential helper). Юниты создают временные репозитории через
 * `git init` / `git -C tmp …`, и с унаследованным `GIT_DIR` каждая такая
 * команда пишет в НАСТОЯЩИЙ репозиторий: переинициализация как bare, коммиты
 * фикстур на ветку, переименование ветки в dev, user.name в общий config — всё
 * это случилось на первом живом прогоне. Набор обязан видеть то же окружение,
 * что и при ручном `npm run gate:small`, поэтому все GIT_* снимаются.
 */
export function gateEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !/^GIT_/i.test(key)));
}

const gitOut = (args) => {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
};

/** Режим хука целиком; возвращает код выхода. `runGate(base)` — код выхода набора. */
export function runHook({
  stdin,
  env = process.env,
  log = (line) => console.error(line),
  git = gitOut,
  runGate = (base) => {
    const { cmd, shell } = portableCommand(process.execPath);
    return spawnSync(cmd, [resolve(ROOT, 'scripts/gate-small.mjs'), `--base=${base}`],
      { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'], shell, env: gateEnv(env) }).status ?? 1;
  },
} = {}) {
  const plan = planHook({
    mode: gateMode(env),
    refs: parsePushLines(stdin),
    headSha: git(['rev-parse', 'HEAD']),
    mergeBase: (sha) => git(['merge-base', sha, 'refs/remotes/origin/dev']),
    changedFiles: (base, sha) => {
      const out = git(['diff', '--name-only', base, sha]);
      return out === null ? null : out.split('\n').filter(Boolean);
    },
  });
  if (plan.action === 'skip') {
    log(`pre-push-gate: ${plan.reason}`);
    return 0;
  }
  if (plan.action === 'reject') {
    log(`pre-push-gate: push отклонён — ${plan.reason}`);
    return 1;
  }
  log(`pre-push-gate: ${plan.reason} — прогоняю npm run gate:small (выключить: HP_PREPUSH_GATE=0)`);
  const code = runGate(plan.base);
  if (code !== 0) {
    log('pre-push-gate: gate:small красный — push отклонён. Починить и повторить;'
      + ' осознанный обход: HP_PREPUSH_GATE=0 git push … (Validate найдёт то же самое позже)');
    return 1;
  }
  log('pre-push-gate: gate:small зелёный');
  return 0;
}

// ---- ручной набор (#343) --------------------------------------------------

function manualGate(argv) {
  const flag = (name) => argv.includes(`--${name}`);
  const value = (name, fallback) => {
    const found = argv.find((item) => item.startsWith(`--${name}=`));
    if (found) return found.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')
      ? argv[index + 1] : fallback;
  };

  const base = value('base', 'origin/dev');
  const head = value('head', 'HEAD');
  const maxSmokes = Number(value('max-smokes', 6));
  const maxMutants = Number(value('max-mutants', 2));

  const run = (label, command, args, options = {}) => {
    const started = Date.now();
    process.stdout.write(`\n── ${label}\n   ${command} ${args.join(' ')}\n`);
    const { cmd, shell } = portableCommand(command);
    const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell, ...options });
    const seconds = ((Date.now() - started) / 1000).toFixed(0);
    const ok = result.status === 0;
    process.stdout.write(`   ${ok ? 'ok' : 'ПРОВАЛ'} · ${seconds} с\n`);
    return { label, ok, seconds: Number(seconds), command: `${command} ${args.join(' ')}` };
  };

  const capture = (command, args) => spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });

  const steps = [];
  const skipped = [];

  // ---- приведена ли ветка к dev ---------------------------------------------
  // Конвейер ребейзит сам (#257), но после ребейза разбор становится полным, а не
  // по дельте (§7.2), и конфликт всплывает в комментарии через сорок минут вместо
  // машины автора. Поэтому предупреждение, а не гейт: гейтом остаётся конвейер.
  if (!flag('no-rebase-check')) {
    const fetched = capture('git', ['fetch', '-q', 'origin', base.replace(/^origin\//, '')]);
    if (fetched.status !== 0) {
      skipped.push(`проверка отставания от ${base} — git fetch не удался`);
    } else {
      const ancestor = capture('git', ['merge-base', '--is-ancestor', base, head]);
      if (ancestor.status === 0) {
        console.log(`\n── Ветка\n   содержит весь ${base}, ребейз не нужен`);
      } else {
        const counted = capture('git', ['rev-list', '--count', `${head}..${base}`]);
        const advice = rebaseAdvice({ behind: Number(counted.stdout.trim()), base });
        if (advice) skipped.push(advice);
      }
    }
  }

  // ---- что тронуто ----------------------------------------------------------
  const diff = capture('git', ['diff', '--name-only', `${base}..${head}`]);
  if (diff.status !== 0) {
    console.error(`git diff ${base}..${head} не удался:\n${diff.stderr}`);
    return 2;
  }
  const changed = diff.stdout.split('\n').filter(Boolean);
  console.log(`Диапазон ${base}..${head}: файлов ${changed.length}`);
  for (const file of changed.slice(0, 20)) console.log(`  ${file}`);
  if (changed.length > 20) console.log(`  и ещё ${changed.length - 20}`);
  if (!changed.length) {
    console.log('\nДиффа нет — проверять нечего.');
    return 0;
  }

  // ---- типы и юниты: всегда -------------------------------------------------
  steps.push(run('Типы', 'npx', ['tsc', '--noEmit']));
  steps.push(run('Юнит-тесты', 'npm', ['test']));

  // ---- смоки по диффу -------------------------------------------------------
  if (flag('no-smokes')) {
    skipped.push('смоки — запрошено --no-smokes');
  } else {
    const select = capture('node', ['scripts/smoke-select.mjs', '--base', base, '--head', head, '--json']);
    let picked = [];
    let parsed = null;
    try {
      parsed = JSON.parse(select.stdout || '{}');
      // Прямое совпадение и зарегистрированная связь — разные виды ответа, но для
      // прогона равноправны. Третий вид, `unproven`, смоков не даёт и обязан
      // прозвучать отдельно: это не «проверять нечего» (#241).
      picked = [...new Set([
        ...(parsed.direct || []).map((item) => item.smoke),
        ...(parsed.registered || []).map((item) => item.smoke),
      ])].filter((name) => typeof name === 'string');
    } catch {
      skipped.push('смоки — не удалось разобрать вывод smoke-select (запустите его вручную)');
    }
    if (parsed?.noExecutableDiff) {
      console.log('\n── Смоки\n   исполняемого кода дифф не трогает — смоки не требуются');
    } else if (parsed?.unproven) {
      skipped.push('смоки — дифф исполняемый, но связь ни с одним смоком не доказана.'
        + ' Это НЕ «проверять нечего»: молчание здесь стоило #234 бета-блокирующего'
        + ' регресса. Либо назовите смок в scripts/smoke-links.mjs, либо напишите новый');
    }
    if (picked.length) {
      // Стенд читает свою копию бандла; без раскладки смок врёт согласованно (#236).
      const missingEntries = ['houseplan-card.js', 'houseplan-panel.js']
        .filter((name) => !existsSync(resolve(ROOT, 'dist', name)));
      if (!missingEntries.length) {
        steps.push(run('Раскладка бандла', 'node', ['scripts/bundle-sync.mjs']));
      } else {
        skipped.push(`смоки — нет dist/${missingEntries.join(', dist/')}, нужен \`npm run build\``);
        picked = [];
      }
    }
    if (picked.length > maxSmokes) {
      skipped.push(`смоки помимо первых ${maxSmokes}: ${picked.slice(maxSmokes).join(', ')}`
        + ' — снимите ограничение --max-smokes, если время есть');
      picked = picked.slice(0, maxSmokes);
    }
    for (const name of picked) {
      steps.push(run(`Смок ${name}`, 'node', [`demo/${name}`]));
    }
  }

  // ---- мутанты по диффу -----------------------------------------------------
  if (flag('no-mutants')) {
    skipped.push('мутанты — запрошено --no-mutants');
  } else {
    const list = capture('node', ['scripts/mutation-gate.mjs', '--changed=' + `${base}..${head}`, '--check']);
    const touched = Number(/мутантов затронуто (\d+)/.exec(list.stdout || '')?.[1] ?? -1);
    if (touched === 0) {
      console.log('\n── Мутанты\n   дифф не задевает ни одного patch.file');
    } else if (touched < 0) {
      skipped.push('мутанты — не удалось определить выборку по диффу');
    } else if (touched > maxMutants) {
      skipped.push(`мутанты (${touched}) — больше лимита ${maxMutants};`
        + ` каждый пересобирает бандл. Прогон: node scripts/mutation-gate.mjs --changed=${base}..${head}`);
    } else {
      steps.push(run('Мутанты по диффу', 'node',
        ['scripts/mutation-gate.mjs', `--changed=${base}..${head}`]));
    }
  }

  // ---- вердикт --------------------------------------------------------------
  const failed = steps.filter((step) => !step.ok);
  const total = steps.reduce((sum, step) => sum + step.seconds, 0);
  console.log(`\n${'═'.repeat(60)}`);
  for (const step of steps) console.log(`${step.ok ? 'ok    ' : 'ПРОВАЛ'} ${step.label} (${step.seconds} с)`);
  console.log(`Суммарно: ${Math.floor(total / 60)} мин ${total % 60} с`);
  if (skipped.length) {
    console.log('\nЧего этот набор НЕ проверял:');
    for (const item of skipped) console.log(`  · ${item}`);
  }
  console.log('  · golden, полная матрица смоков, HA-харнесс — heavy-набор Validate на кандидате;'
    + ' весь мутационный реестр — ночное расписание (#513), не этот набор');
  if (failed.length) {
    console.log(`\nПровалов: ${failed.length}. Пуш до починки — это лишний раунд ревью.`);
    for (const step of failed) console.log(`  ${step.command}`);
  }
  return failed.length ? 1 : 0;
}

if (isMainModule(import.meta.url)) {
  const argv = process.argv.slice(2);
  process.exitCode = argv.includes('--hook')
    ? runHook({ stdin: readFileSync(0, 'utf8') })
    : manualGate(argv);
}
