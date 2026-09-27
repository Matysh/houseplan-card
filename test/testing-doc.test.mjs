// #634/#681: docs/TESTING.md — единственная инструкция по тестированию (AC3 #634:
// ≤ 800 строк). Ручных чек-листов по поверхностям и приложений по issue нет
// (#681): то, чего автоматика не видит, — один раздел в самой инструкции.
// В docs/testing-notes/ живёт только реестр браузерных гвардов #659.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { headings, markdownLinks } from '../scripts/md-anchors.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
const MANUAL_HEADING = '## Чего не проверяет автоматика';

test('#681 TESTING.md: инструкция не длиннее 800 строк и сама называет, чего не проверяет автоматика', () => {
  const testing = read('docs/TESTING.md');
  const lines = testing.split('\n').length - (testing.endsWith('\n') ? 1 : 0);
  assert.ok(lines <= 800, `docs/TESTING.md: ${lines} строк > 800 — приложения по issue сюда не пишутся (#681)`);
  // Правила для новых тестов остаются в инструкции — их читают все.
  assert.match(testing, /^## Правила для новых тестов \(issue #85\) — обязательны$/m);
  const lineOf = (heading) => testing.split('\n').indexOf(heading);
  assert.ok(lineOf(MANUAL_HEADING) > 0, `нет раздела «${MANUAL_HEADING.slice(3)}» — ручные пункты без дома`);
  const own = new Set(headings(testing).map((heading) => heading.anchor));
  for (const link of markdownLinks(testing)) {
    if (!link.file) { assert.ok(own.has(link.anchor), `TESTING.md: нет заголовка #${link.anchor}`); continue; }
    if (/^[a-z]+:/i.test(link.file)) continue;
    const target = join(ROOT, 'docs', link.file);
    assert.ok(existsSync(target), `TESTING.md ссылается на отсутствующий ${link.file}`);
    if (link.anchor && target.endsWith('.md')) {
      const anchors = new Set(headings(readFileSync(target, 'utf8')).map((heading) => heading.anchor));
      assert.ok(anchors.has(link.anchor), `TESTING.md: нет заголовка ${link.file}#${link.anchor}`);
    }
  }
});

test('#681 docs/testing-notes: только реестр браузерных гвардов #659, чек-листы не возвращаются', () => {
  const notes = join(ROOT, 'docs/testing-notes');
  assert.deepEqual(readdirSync(notes).sort(), ['mutation-browser-guards.md'],
    'docs/testing-notes/ снова копит чек-листы: ручной пункт — в «Чего не проверяет автоматика», поведение — в тест');
  assert.ok(existsSync(join(dirname(notes), 'TESTING.md')));
});
