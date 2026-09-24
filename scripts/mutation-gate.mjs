#!/usr/bin/env node
// Mutation gate CLI. Declarations, selection/fingerprints and execution live
// behind separate module boundaries so registry growth does not make every
// runner change conflict with hundreds of mutation definitions (#558).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MUTANTS } from './mutation-registry.mjs';
import {
  applyPatches, buildBundle, dropWorktree, guardNeedsBundle, guardNeedsTestBuild,
  makeWorktree, runCleanGuards, runMutant,
} from './mutation-execution.mjs';
import {
  ANCHOR_RADIUS_LINES, MUTATION_REGISTRY_FILES, anchorRegion, anchorSpan,
  baseRegistry, createGuardInputResolver, guardFiles, guardInputs,
  packageJsonRelevance, parseDiffRanges, patchTouched, registryDelta,
  selectChangedMutants, selectForDiff, shardMutants, wrapperInputs,
} from './mutation-selection.mjs';
import {
  LEDGER_SCHEMA, readLedger, recordCaught, splitByLedger, witnessFingerprint,
} from './mutation-evidence.mjs';
import { attributeSetupFailure } from './mutation-attribution.mjs';
import { guardEnvironment, planEnvironment, planEnvironmentLines } from './mutation-environment.mjs';
import { MUTATION_OUTCOME, isProofOutcome } from './mutation-guard-outcome.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Preserve the public module surface used by tests and reporting scripts while
// callers migrate to the narrower modules at their own pace.
export {
  ANCHOR_RADIUS_LINES, LEDGER_SCHEMA, MUTANTS, MUTATION_REGISTRY_FILES,
  anchorRegion, anchorSpan, applyPatches, baseRegistry, createGuardInputResolver,
  guardFiles, guardInputs, guardNeedsBundle, guardNeedsTestBuild,
  packageJsonRelevance, parseDiffRanges, patchTouched, readLedger, recordCaught,
  registryDelta, selectChangedMutants, selectForDiff, shardMutants,
  splitByLedger, witnessFingerprint, wrapperInputs,
};

export async function main(argv) {
  const planStarted = performance.now();
  let guardInputReads = 0;
  const inputsOf = createGuardInputResolver({
    read: (file) => {
      guardInputReads += 1;
      const path = join(repoRoot, file);
      return existsSync(path) ? readFileSync(path, 'utf8') : '';
    },
  });
  let planMetricsReported = false;
  const reportPlanMetrics = () => {
    if (planMetricsReported) return;
    planMetricsReported = true;
    const stats = inputsOf.stats();
    console.log(`plan-metrics: guard-input requests=${stats.requests}, computations=${stats.computations}, `
      + `cache-hits=${stats.hits}, unique-guards=${stats.uniqueGuards}, source-reads=${guardInputReads}, `
      + `duration-ms=${(performance.now() - planStarted).toFixed(1)}`);
  };
  const idArg = argv.find((a) => a.startsWith('--id='))?.slice(5);
  let selected = idArg ? MUTANTS.filter((m) => m.id === idArg) : MUTANTS;
  if (idArg && !selected.length) {
    console.error(`мутант «${idArg}» не объявлен; --list покажет реестр`);
    return 2;
  }

  const changedArg = argv.find((a) => a === '--changed' || a.startsWith('--changed='));
  let rangeBase = null;
  const ledgerArg = argv.find((a) => a.startsWith('--ledger='))?.slice(9);
  if (ledgerArg && !changedArg) {
    // Полный прогон журнал не читает — он его пишет по расписанию целиком;
    // читать журнал в полном прогоне значило бы никогда не перепроверять.
    console.error('--ledger работает только вместе с --changed: полный прогон журнал не читает');
    return 2;
  }
  if (changedArg) {
    const range = changedArg.includes('=') ? changedArg.split('=')[1] : 'origin/dev..HEAD';
    const diff = spawnSync('git', ['-C', repoRoot, 'diff', '--name-only', range],
      { encoding: 'utf8' });
    if (diff.status !== 0) {
      console.error(`git diff ${range} не удался:\n${diff.stderr}`);
      return 2;
    }
    let files = diff.stdout.split('\n').filter(Boolean);
    const before = selected.length;
    // #496: package.json отбирает ~все гварды; добавленный script — не вход.
    if (files.includes('package.json') && range.includes('..')) {
      const [baseRef, headRef] = range.split('..');
      const show = (ref) => spawnSync('git', ['-C', repoRoot, 'show', `${ref}:package.json`], { encoding: 'utf8' });
      const baseShown = show(baseRef); const headShown = show(headRef || 'HEAD');
      const relevance = (baseShown.status === 0 && headShown.status === 0)
        ? packageJsonRelevance(baseShown.stdout, headShown.stdout)
        : { relevant: true, reason: 'package.json базы или головы не прочитан' };
      console.log(`package.json в диффе: ${relevance.relevant ? 'задевает гварды' : 'гварды не задевает'} — ${relevance.reason}`);
      if (!relevance.relevant) files = files.filter((f) => f !== 'package.json');
    }
    // База диапазона нужна не только отбору: по ней атрибутируется отказ
    // подготовки (#568).
    rangeBase = range.includes('..') ? range.split('..')[0] : range;
    // #492 §6.4: правка реестра отбирает добавленные и изменённые определения
    // явно — новый свидетель не обязан трогать чужие patch/guard-файлы.
    let base = null;
    if (files.some((file) => MUTATION_REGISTRY_FILES.includes(file))) {
      const baseRef = range.includes('..') ? range.split('..')[0] : range;
      base = await baseRegistry(baseRef);
      if (!base) console.log(`реестр базы ${baseRef} не прочитан — отбор по определениям пропущен`);
    }
    // #518: области диффа сужают сторону патча до окрестности якоря. Не
    // прочитались — отбор остаётся файловым, то есть прежним и более широким.
    const hunks = spawnSync('git', ['-C', repoRoot, 'diff', '--unified=0', '--no-color', range],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const ranges = hunks.status === 0 && !hunks.error ? parseDiffRanges(hunks.stdout) : null;
    if (!ranges) console.log('области диффа не прочитаны — отбор по файлам целиком');
    const wide = selectForDiff(selected, files, base, { guardInputs: inputsOf });
    const picked = selectForDiff(selected, files, base, { ranges, guardInputs: inputsOf });
    if (picked.removed.length) console.log(`удалены из реестра: ${picked.removed.join(', ')}`);
    selected = picked.selected;
    console.log(`дифф-режим ${range}: файлов в диффе ${files.length}, `
      + `мутантов затронуто ${selected.length} из ${before} (по файлам ${picked.byFiles.length}, по определениям ${picked.byRegistry.length})`);
    if (ranges && wide.selected.length !== selected.length) {
      console.log(`области якорей (радиус ${ANCHOR_RADIUS_LINES} строк, #518): `
        + `${wide.selected.length} → ${selected.length}`);
    }
    if (!selected.length) {
      console.log('дифф не задевает ни одной области якоря — гонять нечего; '
        + 'полный реестр идёт ночным расписанием (#513)');
      if (argv.includes('--plan-only')) console.log('plan=0');
      reportPlanMetrics();
      return 0;
    }
  }

  const shardArg = argv.find((a) => a.startsWith('--shard='))?.slice(8);
  if (shardArg) {
    const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(shardArg);
    if (!match || Number(match[1]) > Number(match[2])) {
      console.error(`--shard ожидает i/n с 1 <= i <= n, получено «${shardArg}»`);
      return 2;
    }
    const before = selected.length;
    selected = shardMutants(selected, Number(match[1]), Number(match[2]));
    console.log(`шард ${shardArg}: ${selected.length} из ${before} мутантов`);
  }

  if (argv.includes('--list')) {
    for (const m of MUTANTS) console.log(`${m.id}\n  guard: ${m.guard}\n  ${m.because}\n`);
    reportPlanMetrics();
    return 0;
  }

  if (argv.includes('--check')) {
    let stale = 0;
    for (const m of selected) {
      try {
        // #499: бандл мутанта собирает раннер (`buildBundle`, только rollup +
        // sync). Гвард с собственным `npm run bundle:sync` собирал бы его второй
        // раз — плюс `tsc --noEmit`, который на нестрогом мутанте падает сам и
        // красит гвард ещё до теста: «мутант пойман» без единого запуска смока.
        if (/bundle:sync|bundle-sync\.mjs|rollup -c/.test(m.guard)) {
          throw new Error('гвард сам собирает бандл — сборку делает раннер (#499)');
        }
        for (const patch of m.patches) {
          const source = readFileSync(join(repoRoot, patch.file), 'utf8');
          const hits = source.split(patch.find).length - 1;
          if (hits !== 1) throw new Error(`якорь найден ${hits} раз(а)`);
        }
        console.log(`ok   ${m.id}`);
      } catch (error) {
        console.log(`FAIL ${m.id}: ${error.message}`);
        stale++;
      }
    }
    reportPlanMetrics();
    return stale ? 2 : 0;
  }

  if (argv.includes('--build-only')) {
    for (const m of selected) {
      const dir = makeWorktree();
      try {
        applyPatches(dir, m.patches);
        buildBundle(dir);
        console.log(`ok   ${m.id}: патч лёг, бандл собрался`);
      } catch (error) {
        console.log(`FAIL ${m.id}: ${error.message}`);
        return 2;
      } finally {
        dropWorktree(dir);
      }
    }
    reportPlanMetrics();
    return 0;
  }

  // Журнал (#481): отобранные по диффу мутанты, чьи входы не менялись с
  // последнего пойманного прогона, не гоняются повторно.
  let plan = selected.map((mutant) => ({ mutant, fingerprint: null }));
  let ledger = null;
  if (ledgerArg) {
    ledger = readLedger(ledgerArg);
    const split = splitByLedger(selected, ledger,
      (mutant) => witnessFingerprint(mutant, { inputsOf }));
    console.log(`журнал ${ledgerArg}: по журналу пропущено ${split.skipped.length} `
      + `(отпечатки совпали), к прогону ${split.run.length}`);
    plan = split.run;
    if (!plan.length) {
      console.log('все отобранные свидетели уже пойманы на этих же входах — гонять нечего');
      if (argv.includes('--plan-only')) console.log('plan=0');
      reportPlanMetrics();
      return 0;
    }
  }
  const toRun = plan.map((entry) => entry.mutant);
  // #518: `--plan-only` считает план и выходит — job мутантов спрашивает его
  // ДО установки окружения (npm ci, python, Chromium ≈ 3 минуты на шард).
  if (argv.includes('--plan-only')) {
    console.log(`plan=${toRun.length}`);
    // #620: и какое окружение нужно гардам плана — шаг ставит только его.
    const exists = (file) => existsSync(join(repoRoot, file));
    const read = (file) => (exists(file) ? readFileSync(join(repoRoot, file), 'utf8') : '');
    const need = planEnvironment(toRun, (guard) => guardEnvironment(guard, { read, exists }));
    for (const line of planEnvironmentLines(need)) console.log(line);
    reportPlanMetrics();
    return 0;
  }
  reportPlanMetrics();
  if (!runCleanGuards(toRun)) return 2;
  let caught = 0;
  let unverifiable = false;
  // #568: свидетель, который не готовится к прогону, ломает гейт той задачи,
  // чей дифф его выбрал, — а причина может лежать в чужом коммите. Тогда автор
  // либо чинит чужое, либо стоит; я сам потерял на этом два круга. Поэтому
  // отказ подготовки атрибутируется: тот же мутант прогоняется на дереве базы
  // диапазона. Ложных срабатываний тут быть не может — сравниваются два
  // прогона одного и того же мутанта, а не код с ожиданием.
  const preExisting = [];
  for (const entry of plan) {
    const outcome = runMutant(entry.mutant);
    if (!isProofOutcome(outcome)) {
      if (outcome.kind === MUTATION_OUTCOME.SETUP) {
        const verdict = await attributeSetupFailure(entry.mutant, outcome, rangeBase);
        if (verdict === 'pre-existing') {
          // Не красим гейт этой задачи (решение владельца 14.09): поломка не из
          // этого диффа. Но и не теряем её — она названа здесь и обязана
          // покраснеть в ночном полном прогоне, у которого есть адресат (#472).
          console.log(`     ПРЕДСУЩЕСТВУЮЩИЙ: не готовится и на базе — отказ не из этого диффа`);
          preExisting.push(entry.mutant.id);
          continue;
        }
        if (verdict === 'introduced') {
          console.log('     отказ внесён этим диффом: на базе тот же мутант готовится');
        }
      }
      if (outcome.kind !== MUTATION_OUTCOME.SURVIVED) unverifiable = true;
      continue;
    }
    caught++;
    if (ledger) recordCaught(ledgerArg, ledger, entry.mutant, entry.fingerprint, outcome.proof);
  }
  console.log(`\nпоймано ${caught} из ${toRun.length - preExisting.length}`);
  if (preExisting.length) {
    // Строку читает человек и (при желании) CI. Формат менять синхронно с теми,
    // кто её разбирает.
    console.log(`предсуществующих отказов подготовки: ${preExisting.length}`);
    console.log(`pre-existing-setup-failures=${preExisting.join(',')}`);
    console.log('Эти свидетели мертвы до текущего диффа: гейт задачи они не красят, '
      + 'а ночной полный прогон обязан их назвать (#472, #568).');
  }
  if (unverifiable) return 2;
  return caught === toRun.length - preExisting.length ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err);
    process.exit(2);
  });
}
