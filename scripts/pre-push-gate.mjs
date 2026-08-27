#!/usr/bin/env node
/**
 * Локальный набор гейтов перед пушем (#343).
 *
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
 * 3. **Он не претендует на полноту.** Golden, полная матрица смоков,
 *    HA-харнесс и весь мутационный реестр — предрелизный гейт; здесь только то,
 *    что укладывается в минуты и ловит 90% возвратов.
 *
 * Бандл не собирается: `bundle-sync.mjs` раскладывает закоммиченный `dist`, а
 * свежесть проверяет сам продукт — `assertFreshDemoBundle` внутри каждого смока
 * сверяет вшитый отпечаток с исходниками дерева и скажет, если нужна пересборка.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
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
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const ok = result.status === 0;
  process.stdout.write(`   ${ok ? 'ok' : 'ПРОВАЛ'} · ${seconds} с\n`);
  return { label, ok, seconds: Number(seconds), command: `${command} ${args.join(' ')}` };
};

const capture = (command, args) => spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });

const steps = [];
const skipped = [];

// ---- что тронуто ----------------------------------------------------------
const diff = capture('git', ['diff', '--name-only', `${base}..${head}`]);
if (diff.status !== 0) {
  console.error(`git diff ${base}..${head} не удался:\n${diff.stderr}`);
  process.exit(2);
}
const changed = diff.stdout.split('\n').filter(Boolean);
console.log(`Диапазон ${base}..${head}: файлов ${changed.length}`);
for (const file of changed.slice(0, 20)) console.log(`  ${file}`);
if (changed.length > 20) console.log(`  и ещё ${changed.length - 20}`);
if (!changed.length) {
  console.log('\nДиффа нет — проверять нечего.');
  process.exit(0);
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
    if (existsSync(resolve(ROOT, 'dist/houseplan-card.js'))) {
      steps.push(run('Раскладка бандла', 'node', ['scripts/bundle-sync.mjs']));
    } else {
      skipped.push('смоки — нет dist/houseplan-card.js, нужен `npm run build`');
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
console.log('  · golden, полная матрица смоков, HA-харнесс, весь мутационный реестр —'
  + ' предрелизный гейт, не этот набор');
if (failed.length) {
  console.log(`\nПровалов: ${failed.length}. Пуш до починки — это лишний раунд ревью.`);
  for (const step of failed) console.log(`  ${step.command}`);
}
process.exit(failed.length ? 1 : 0);
