import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MUTANTS, applyPatches } from '../scripts/mutation-gate.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Дешёвая половина гейта, идёт с обычными юнитами на каждом прогоне. Полный
// прогон с пересборкой бандла на мутанта — предрелизный, он в
// .github/workflows/mutation-gate.yml.
//
// Реестр, отставший от кода, хуже отсутствующего: он выглядит защитой. Поэтому
// дрейф якорей ловится здесь, а не при редком полном прогоне.

test('every mutant patch anchors exactly once in the current source', () => {
  for (const mutant of MUTANTS) {
    for (const patch of mutant.patches) {
      const path = join(repoRoot, patch.file);
      assert.ok(existsSync(path), `${mutant.id}: файла ${patch.file} больше нет`);
      const source = readFileSync(path, 'utf8');
      const hits = source.split(patch.find).length - 1;
      assert.equal(hits, 1,
        `${mutant.id}: якорь в ${patch.file} найден ${hits} раз(а) — реестр отстал от кода`);
      assert.notEqual(patch.find, patch.replace, `${mutant.id}: патч ничего не меняет`);
    }
  }
});

test('every guard command points at a file that exists', () => {
  for (const mutant of MUTANTS) {
    const script = mutant.guard.split(' ').find((part) => part.endsWith('.mjs'));
    assert.ok(script, `${mutant.id}: guard не называет исполняемый файл`);
    assert.ok(existsSync(join(repoRoot, script)),
      `${mutant.id}: guard-файла ${script} не существует`);
  }
});

test('every mutant explains itself', () => {
  const ids = new Set();
  for (const mutant of MUTANTS) {
    assert.ok(mutant.because && mutant.because.length > 40,
      `${mutant.id}: без объяснения мутант превратится в карго-культ`);
    assert.ok(!ids.has(mutant.id), `дубль id: ${mutant.id}`);
    ids.add(mutant.id);
  }
  assert.ok(MUTANTS.length >= 6, 'стартовый набор — шесть мутантов по дырам из #85');
});

test('applyPatches rewrites the anchor and refuses a stale one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-mg-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'a.ts'), 'const KEEP = 1;\nconst FEATHER = 2;\n');

    applyPatches(dir, [{ file: 'src/a.ts', find: 'const FEATHER = 2;', replace: 'const FEATHER = 20;' }]);
    assert.match(readFileSync(join(dir, 'src', 'a.ts'), 'utf8'), /FEATHER = 20/);

    // Якоря нет — отказ, а не тихий пропуск: патч «в никуда» выглядит защитой.
    assert.throws(
      () => applyPatches(dir, [{ file: 'src/a.ts', find: 'no such anchor', replace: 'x' }]),
      /0 раз/,
    );

    // Якорь двоится — тоже отказ: патч лёг бы «куда попало».
    writeFileSync(join(dir, 'src', 'a.ts'), 'twice\ntwice\n');
    assert.throws(
      () => applyPatches(dir, [{ file: 'src/a.ts', find: 'twice', replace: 'x' }]),
      /2 раз/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
