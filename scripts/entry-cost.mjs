#!/usr/bin/env node
// #634: стоимость входа агента — сколько слов он читает до первого файла кода.
//
// Аудит 22.09 намерил ≈ 26 700 слов обязательного входа (SCOPE, AGENTS, полный
// PROCESS, STATUS) — 43–77 k токенов до первой строки кода. Ролевые конспекты
// `docs/process/AUTHOR.md` и `REVIEWER.md` заменяют на входе полный канон, а
// этот скрипт держит цену входа измеримой: маршрут по роли — один список здесь,
// `AGENTS.md` («Read this first») называет те же файлы в том же порядке, и тест
// `test/entry-cost.test.mjs` сверяет оба и краснеет на превышении бюджета.
//
//   node scripts/entry-cost.mjs            таблица по всем маршрутам
//   node scripts/entry-cost.mjs --check    exit 1, если маршрут с бюджетом его превысил
//   node scripts/entry-cost.mjs --json
//
// Слово — как у `wc -w`: непустой отрезок между пробельными символами. Токены
// не считаются: их число зависит от токенизатора, а слова — нет.
// Вне замера сознательно: `CODEX-RUNBOOK.md` и `CLAUDE.md` папки владельца —
// они не в репозитории, и CI их не видит; тело issue — своё у каждой задачи.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './spawn-portable.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Маршруты входа по роли. `budget: null` — только замер, без порога. */
export const ROUTES = Object.freeze({
  author: {
    budget: 12000, // AC1 #634
    files: ['docs/SCOPE.md', 'AGENTS.md', 'docs/process/AUTHOR.md', 'docs/STATUS.md'],
  },
  reviewer: {
    budget: 9000,
    files: ['docs/SCOPE.md', 'AGENTS.md', 'docs/process/REVIEWER.md'],
  },
  // Тот, кто правит конвейер, гейты или сам процесс, читает канон целиком.
  canon: {
    budget: null,
    files: ['docs/SCOPE.md', 'AGENTS.md', 'PROCESS.md', 'docs/STATUS.md'],
  },
});

export const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

/** Замер одного маршрута: слова по файлам, сумма и вердикт бюджета. */
export function measureRoute(route, read = (rel) => readFileSync(join(ROOT, rel), 'utf8')) {
  const files = route.files.map((file) => ({ file, words: countWords(read(file)) }));
  const total = files.reduce((sum, row) => sum + row.words, 0);
  const over = route.budget != null && total > route.budget;
  return { files, total, budget: route.budget, over };
}

export function measureAll(routes = ROUTES, read) {
  return Object.fromEntries(Object.entries(routes).map(([name, route]) => [name, measureRoute(route, read)]));
}

export function renderTable(results) {
  const lines = [];
  for (const [name, result] of Object.entries(results)) {
    const limit = result.budget == null ? 'без бюджета' : `бюджет ${result.budget}`;
    const mark = result.over ? '  ПРЕВЫШЕН' : '';
    lines.push(`${name}: ${result.total} слов (${limit})${mark}`);
    for (const row of result.files) lines.push(`  ${String(row.words).padStart(6)}  ${row.file}`);
  }
  return lines.join('\n');
}

if (isMainModule(import.meta.url)) {
  const results = measureAll();
  if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
  else console.log(renderTable(results));
  if (process.argv.includes('--check')) {
    const failed = Object.entries(results).filter(([, result]) => result.over).map(([name]) => name);
    if (failed.length) {
      console.error(`entry-cost: превышен бюджет входа: ${failed.join(', ')}`);
      process.exit(1);
    }
  }
}
