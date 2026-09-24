// #634: docs/TESTING.md — действующая инструкция (AC3: ≤ 800 строк), приложения
// по issue и ручные чек-листы — в docs/testing-notes/, доступны по индексу.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { headings, markdownLinks } from '../scripts/md-anchors.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NOTES = 'docs/testing-notes';
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
const noteFiles = () => readdirSync(join(ROOT, NOTES)).filter((name) => name.endsWith('.md') && name !== 'README.md').sort();

test('#634 TESTING.md: инструкция не длиннее 800 строк и ведёт к индексу приложений (AC3)', () => {
  const testing = read('docs/TESTING.md');
  const lines = testing.split('\n').length - (testing.endsWith('\n') ? 1 : 0);
  assert.ok(lines <= 800, `docs/TESTING.md: ${lines} строк > 800 — приложение по issue кладётся в ${NOTES}/`);
  assert.ok(markdownLinks(testing).some((link) => link.file === 'testing-notes/README.md'), 'ссылка на индекс');
  // Правила для новых тестов остаются в инструкции — их читают все.
  assert.match(testing, /^## Правила для новых тестов \(issue #85\) — обязательны$/m);
});

test('#634 индекс приложений: каждый раздел каждого приложения — строкой, каждая ссылка жива', () => {
  const index = read(`${NOTES}/README.md`);
  const links = markdownLinks(index);
  const listed = new Set(links.map((link) => `${link.file}#${link.anchor}`));
  const files = noteFiles();
  assert.ok(files.length >= 5, 'приложения на месте');
  for (const file of files) {
    assert.ok(links.some((link) => link.file === file && !link.anchor), `${file}: нет заголовка группы в индексе`);
    for (const heading of headings(read(`${NOTES}/${file}`)).filter((h) => h.level >= 2)) {
      assert.ok(listed.has(`${file}#${heading.anchor}`), `${file}: раздел «${heading.text}» не в индексе`);
    }
  }
  for (const link of links) {
    if (link.file.startsWith('../')) { assert.ok(existsSync(join(ROOT, 'docs', link.file.slice(3)))); continue; }
    assert.ok(files.includes(link.file), `индекс ссылается на отсутствующий файл ${link.file}`);
    if (!link.anchor) continue;
    const anchors = new Set(headings(read(`${NOTES}/${link.file}`)).map((heading) => heading.anchor));
    assert.ok(anchors.has(link.anchor), `индекс: нет заголовка ${link.file}#${link.anchor}`);
  }
});
