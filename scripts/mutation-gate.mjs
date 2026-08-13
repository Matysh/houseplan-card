#!/usr/bin/env node
// Реестр известных поломок (mutation gate), issue #85.
//
//   node scripts/mutation-gate.mjs --list          мутанты и кого они проверяют
//   node scripts/mutation-gate.mjs --check         патчи применимы к текущему коду
//   node scripts/mutation-gate.mjs                 полный прогон: все мутанты
//   node scripts/mutation-gate.mjs --id=<mutant>   один мутант
//   node scripts/mutation-gate.mjs --build-only    применить и собрать, тест не гонять
//
// Код выхода: 0 — каждый тест поймал свою поломку, 1 — хотя бы один не поймал,
// 2 — не смог проверить (патч не лёг, сборка упала).
//
// Зачем. Зелёный тест в этом проекте несколько раз означал «ничего не
// проверено», и выяснялось это после того, как баг доезжал до владельца:
// смок непрерывности не заметил удаления механизма, который защищает; golden,
// заведённый под #71, был пуст — 1 177 тёплых пикселей против 107 119, и все
// 1 177 были иконками. Общее у всех случаев: тест ни разу не проверяли на
// способность падать. Этот гейт делает такую проверку регулярной.
//
// Каждый мутант — маленький патч продуктового исходника, воспроизводящий
// известную поломку, и имя теста, который ОБЯЗАН на ней покраснеть. Прогон:
// worktree → патч → сборка бандла → бандл в demo/srv/assets → тест. Тест,
// оставшийся зелёным, — это провал гейта, а не успех теста.
//
// Прогон дорогой (пересборка бандла на мутанта), поэтому его место — перед
// стабильным релизом (.github/workflows/mutation-gate.yml), не на каждой бете.
// Дешёвая часть — «патчи применимы, guard-файлы существуют» — живёт в
// test/mutation-gate.test.mjs и идёт с обычными юнитами: реестр, отставший от
// кода, хуже отсутствующего, потому что выглядит защитой.

import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- реестр ---------------------------------------------------------------
// `find` обязан встречаться в файле ровно один раз: патч, который ложится «куда
// попало», проверяет не то, что объявлен проверять. Это контролирует --check.
export const MUTANTS = [
  {
    id: 'continuity-long-resume-noop',
    guard: 'node demo/smoke_visual_continuity.mjs',
    because: 'смок обязан доказывать, что long-resume СРАБОТАЛ (токен ушёл вперёд), '
      + 'а не что ничего не спрятали: в beta.7 он не заметил удаления всего механизма',
    patches: [{
      file: 'src/visual-continuity.ts',
      find: "if (!signal.long && (signal.kind === 'visible' || signal.kind === 'pageshow')) {",
      replace: "if ((signal.kind === 'visible' || signal.kind === 'pageshow')) {",
    }],
  },
  {
    id: 'opening-cut-degenerate',
    guard: 'node demo/smoke_glow.mjs',
    because: 'проём, выродившийся в точку, остаётся кладкой — свет перестаёт '
      + 'проходить через дверь; смок обязан это увидеть по освещённому полу за проёмом',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'cuts.push([o.rx - dx, o.ry - dy, o.rx + dx, o.ry + dy]);',
      replace: 'cuts.push([o.rx, o.ry, o.rx, o.ry]);',
    }],
  },
  {
    id: 'column-shadow-removed',
    guard: 'node demo/smoke_glow.mjs',
    because: 'физические тела выпали из окклюдеров — колонна перестаёт отбрасывать '
      + 'тень; исторически смок теней был зелёным, пока тени физически не рисовались',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'for (const body of physical) occluders.push(...polygonSegments(body));',
      replace: 'void physical;',
    }],
  },
  {
    id: 'feather-20px',
    guard: 'node demo/smoke_glow.mjs',
    because: 'растушёвка 20 px вместо 2 размывает границу света на полкомнаты; '
      + 'смок читает data-feather-px и обязан отвергнуть значение больше 3',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'const GLOW_EDGE_FEATHER_PX = 2;',
      replace: 'const GLOW_EDGE_FEATHER_PX = 20;',
    }],
  },
  {
    id: 'barrier-cache-never-invalidated',
    guard: 'node demo/smoke_openwall.mjs',
    because: 'кэш барьеров, который не инвалидируется по содержимому, — это свет '
      + 'сквозь стену, которая уже существует; смок переключает виртуальную границу '
      + 'и обязан увидеть смену освещённости соседней комнаты',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'if (this._lightBarrierCache?.key === cacheKey) return this._lightBarrierCache.value;',
      replace: 'if (this._lightBarrierCache) return this._lightBarrierCache.value;',
    }],
  },
  {
    id: 'golden-lamp-out-of-reach',
    guard: 'node demo/golden/run.mjs --mode=verify --scenario=lighting-opaque-glow-two-doorways-dark',
    because: 'сцена заведена как защита дверного света (#71) и однажды уже была '
      + 'пустой: лампа стояла так, что пятно не доходило до стены. Уведённая лампа '
      + 'обязана ронять семантический ассерт сцены, а не только пиксельный дифф',
    // Мутируется фикстура сцены, не продуктовый код: пустота сцены — свойство
    // фикстуры. Пересборка бандла всё равно нужна, путь тот же.
    patches: [{
      file: 'demo/golden/matrix.mjs',
      find: "layoutOverrides: { 'golden-light-one': { s: 'golden-lighting', x: 0.40, y: 0.48 } },",
      replace: "layoutOverrides: { 'golden-light-one': { s: 'golden-lighting', x: 0.06, y: 0.90 } },",
    }],
  },
];

// --- механика ---------------------------------------------------------------
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export function applyPatches(root, patches) {
  for (const patch of patches) {
    const path = join(root, patch.file);
    const source = readFileSync(path, 'utf8');
    const hits = source.split(patch.find).length - 1;
    if (hits !== 1) {
      throw new Error(`${patch.file}: якорь найден ${hits} раз(а), нужен ровно 1 — реестр отстал от кода`);
    }
    writeFileSync(path, source.replace(patch.find, patch.replace));
  }
}

function sh(cmd, cwd, extraEnv = {}) {
  return spawnSync(cmd, {
    cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  });
}

function makeWorktree() {
  const dir = mkdtempSync(join(tmpdir(), 'hp-mutant-'));
  const added = spawnSync('git', ['-C', repoRoot, 'worktree', 'add', '--detach', dir, 'HEAD'],
    { encoding: 'utf8' });
  if (added.status !== 0) throw new Error(`git worktree add: ${added.stderr}`);
  // node_modules не копируется — символическая ссылка на настоящий. Установка
  // зависимостей на каждого мутанта превратила бы вечерний гейт в суточный.
  symlinkSync(join(repoRoot, 'node_modules'), join(dir, 'node_modules'), 'junction');
  return dir;
}

function dropWorktree(dir) {
  spawnSync('git', ['-C', repoRoot, 'worktree', 'remove', '--force', dir], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
}

function buildBundle(dir) {
  // Только rollup, без tsc --noEmit: мутант имеет право быть нестрогим по
  // типам — он воспроизводит поломку, а не образцовый код.
  const built = sh('npx rollup -c', dir);
  if (built.status !== 0) {
    throw new Error(`сборка мутанта упала:\n${(built.stderr || built.stdout).slice(-2000)}`);
  }
  cpSync(join(dir, 'dist', 'houseplan-card.js'), join(dir, 'demo', 'srv', 'assets', 'houseplan-card.js'));
}

function runMutant(mutant) {
  const dir = makeWorktree();
  try {
    applyPatches(dir, mutant.patches);
    buildBundle(dir);
    const guard = sh(mutant.guard, dir);
    if (guard.status === 0) {
      console.log(`FAIL ${mutant.id}: тест остался зелёным на сломанном коде`);
      console.log(`     guard: ${mutant.guard}`);
      console.log(`     ${mutant.because}`);
      return false;
    }
    console.log(`ok   ${mutant.id}: тест покраснел, как обязан`);
    return true;
  } finally {
    dropWorktree(dir);
  }
}

// Чистый прогон каждого guard ровно один раз: тест, красный и без мутанта,
// «ловит» поломку тривиально и не доказывает ничего.
function runCleanGuards(mutants) {
  const guards = [...new Set(mutants.map((m) => m.guard))];
  const dir = makeWorktree();
  try {
    buildBundle(dir);
    for (const guard of guards) {
      const result = sh(guard, dir);
      if (result.status !== 0) {
        console.log(`FAIL чистый прогон: ${guard} красный без мутанта`);
        console.log((result.stderr || result.stdout).slice(-1500));
        return false;
      }
      console.log(`ok   чистый прогон: ${guard}`);
    }
    return true;
  } finally {
    dropWorktree(dir);
  }
}

function main(argv) {
  const idArg = argv.find((a) => a.startsWith('--id='))?.slice(5);
  const selected = idArg ? MUTANTS.filter((m) => m.id === idArg) : MUTANTS;
  if (idArg && !selected.length) {
    console.error(`мутант «${idArg}» не объявлен; --list покажет реестр`);
    return 2;
  }

  if (argv.includes('--list')) {
    for (const m of MUTANTS) console.log(`${m.id}\n  guard: ${m.guard}\n  ${m.because}\n`);
    return 0;
  }

  if (argv.includes('--check')) {
    let stale = 0;
    for (const m of selected) {
      try {
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
    return 0;
  }

  if (!runCleanGuards(selected)) return 2;
  let caught = 0;
  for (const m of selected) if (runMutant(m)) caught++;
  console.log(`\nпоймано ${caught} из ${selected.length}`);
  return caught === selected.length ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
