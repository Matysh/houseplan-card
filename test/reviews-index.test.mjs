// #635: индекс ревью — одна строка на документ, детерминированно, 100 % каталога.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildIndex, collectEntries, indexEntry, parseCounts, parseDocName, parseFiles, parseFindings, parseVerdict, renderIndex,
} from '../scripts/reviews-index.mjs';

test('#635 имена документов: этап, issue, раунд; INDEX и чужое — вне схемы', () => {
  assert.deepEqual(parseDocName('CODE-REVIEW-600-r2.md'), { stage: 'code', issue: 600, round: 2, suffix: null });
  assert.deepEqual(parseDocName('SPEC-REVIEW-7-r1.md'), { stage: 'spec', issue: 7, round: 1, suffix: null });
  assert.deepEqual(parseDocName('CODE-REVIEW-issue-5.md'), { stage: 'code', issue: 5, round: null, suffix: null });
  assert.equal(parseDocName('INDEX.md'), null);
  assert.equal(parseDocName('README.md'), null);
});

test('#635 вердикт: явная строка, раздел «Вердикт», свободная форма хвоста, иначе «—»', () => {
  assert.equal(parseVerdict('- Вердикт: **зелёный**'), 'зелёный');
  assert.equal(parseVerdict('Вердикт: жёлтый · заход r1 · High: 0 · Medium: 4'), 'жёлтый');
  assert.equal(parseVerdict('Verdict: **red** · cycle r2/4'), 'красный');
  assert.equal(parseVerdict('## 6. Вердикт\n\nH1 воспроизведён. Это High: блокирует.\n\n## 7. Прочее'), 'красный');
  assert.equal(parseVerdict('## Вердикт\n\nПродуктовый код не менялся, регрессий нет.\n'), 'зелёный');
  assert.equal(parseVerdict('текст без вердикта'), '—');
  assert.equal(parseVerdict('…поэтому **зелёный вердикт**.'), 'зелёный');
  assert.equal(parseVerdict('зелёныйзаголовок вердикта'), '—', 'цвет как часть слова не считается');
  assert.equal(parseVerdict('Вердикт: зелёныйзаголовок без цвета'), '—', 'JS \\b не знает кириллицы — граница слова явная');
});

test('#635 счётчики и находки', () => {
  assert.deepEqual(parseCounts('Вердикт: жёлтый · High: 1 · Medium: 3'), { high: 1, medium: 3 });
  assert.deepEqual(parseCounts('### H1 — a\n### M1 — b\n### M2 — c\n### L1 — d'), { high: 1, medium: 2 });
  assert.deepEqual(parseCounts('ничего'), { high: 0, medium: 0 });
  const findings = parseFindings([
    '### 1. Room settings: подпись переносится посреди слова',
    '### H1 — диалог невидим после крестика',
    '### M2: `rangeLine` клампит каждый символ.',
    '| M3 | `src/x.ts:1` | поле пустое, состояние старое | почему |',
    '| **High** | `y.ts` | импорт теряет маршруты | … |',
    '### 1. Room settings: подпись переносится посреди слова',
    `### 2. ${'очень длинный заголовок '.repeat(8)}`,
  ].join('\n'));
  assert.equal(findings[0], 'Room settings: подпись переносится посреди слова');
  assert.equal(findings[1], 'диалог невидим после крестика');
  assert.equal(findings[2], 'rangeLine клампит каждый символ');
  assert.ok(findings.includes('поле пустое, состояние старое'));
  assert.ok(findings.includes('импорт теряет маршруты'));
  assert.equal(findings.length, 6, 'дубль снят, потолок 6');
  assert.ok(findings.every((f) => f.length <= 90));
});

test('#635 индекс покрывает каталог целиком, детерминирован и не индексирует сам себя', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-reviews-index-'));
  try {
    writeFileSync(join(dir, 'CODE-REVIEW-600-r1.md'), '# x\nВердикт: **жёлтый** · High: 0 · Medium: 4\n### 1. Первая\n### 2. Вторая\n');
    writeFileSync(join(dir, 'CODE-REVIEW-600-r2.md'), '# x\nВердикт: **зелёный** · High: 0 · Medium: 0\n');
    writeFileSync(join(dir, 'SPEC-REVIEW-600-r1.md'), '- Вердикт: **зелёный**\n');
    writeFileSync(join(dir, 'CODE-REVIEW-601-r1.md'), '## Вердикт\n\nсвободная форма\n');
    writeFileSync(join(dir, 'INDEX.md'), 'старый индекс');
    writeFileSync(join(dir, 'notes.md'), 'постороннее');
    const { entries, skipped } = collectEntries(dir);
    assert.equal(entries.length, 4);
    assert.deepEqual(skipped, ['notes.md']);
    const md = buildIndex(dir);
    assert.equal(md, buildIndex(dir), 'детерминирован');
    assert.match(md, /Документов: 4, issue: 2/);
    const rows = md.split('\n').filter((l) => l.startsWith('| #'));
    assert.deepEqual(rows.map((r) => r.split('|')[2].trim()), [
      '[CODE-REVIEW-601-r1.md](CODE-REVIEW-601-r1.md)',
      '[SPEC-REVIEW-600-r1.md](SPEC-REVIEW-600-r1.md)',
      '[CODE-REVIEW-600-r1.md](CODE-REVIEW-600-r1.md)',
      '[CODE-REVIEW-600-r2.md](CODE-REVIEW-600-r2.md)',
    ], 'новые issue сверху; внутри issue — ТЗ, затем код по раундам');
    assert.match(md, /\| #600 \| \[CODE-REVIEW-600-r1\.md\][^\n]*\| code · r1 \| 🟡 жёлтый \| 0 \| 4 \| Первая; Вторая \|/);
    assert.match(md, /\| #601 \|[^\n]*⚪ — \|/);
    assert.match(md, /Вне схемы имён[^\n]*`notes\.md`/);
    assert.ok(!md.includes('INDEX.md](INDEX.md)'), 'индекс не индексирует себя');
    assert.equal(indexEntry('INDEX.md', 'x'), null);
    assert.equal(renderIndex({ entries: [] }).includes('Документов: 0'), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#635 живой каталог docs/reviews: индекс свеж и покрывает все документы', () => {
  const { entries, skipped } = collectEntries(fileURLToPath(new URL('../docs/reviews/', import.meta.url)));
  assert.equal(skipped.length, 0, `вне схемы имён: ${skipped.join(', ')}`);
  assert.ok(entries.length > 900);
  const recognised = entries.filter((e) => e.verdict !== '—').length;
  assert.ok(recognised / entries.length > 0.9, `вердикт распознан у ${recognised} из ${entries.length}`);
});

test('#635 конвейер пересобирает индекс тем же коммитом, что и документ ревью', () => {
  const wf = new URL('../.github/workflows/process.yml', import.meta.url);
  const text = readFileSync(wf, 'utf8');
  assert.match(text, /node scripts\/reviews-index\.mjs --dir=docs\/reviews\n\s+git add -- docs\/reviews\/INDEX\.md/);
});

// r1 #635 H1: индекс молчал о находках в живом формате заголовков и брал
// счётчик из цитаты чужого документа. Строка «0 0 —» неотличима от «находок
// не было» — поэтому оба регресса закреплены фикстурами с реальных документов.
test('#635 r2: счётчик берётся из своего вердикта, а не из первого «High:» по тексту (CODE-REVIEW-594-r1)', () => {
  const doc = [
    '# CODE-REVIEW-594-r1',
    'ТЗ прошло ревью зелёным на r3 (SPEC-REVIEW-594-r3, High: 0, Medium: 0).',
    '## Находки',
    '### Medium (в скоупе задачи) — M1: AC7 не закрыт до конца — эталоны не приняты',
    'текст',
    '### Medium (в скоупе задачи) — M2: отпечаток скриншотов не обновлён',
    '### Low — не блокирует',
    '## Вердикт',
    'Жёлтый. High: 0, Medium: 3.',
  ].join('\n');
  assert.deepEqual(parseCounts(doc), { high: 0, medium: 3 });
  assert.equal(parseVerdict(doc), 'жёлтый');
  assert.deepEqual(parseFindings(doc), ['AC7 не закрыт до конца — эталоны не приняты', 'отпечаток скриншотов не обновлён']);
  // Пересказ чужого раунда строчными в шапке не перебивает свой вердикт (CODE-REVIEW-152-r2).
  const retold = 'r1: вердикт красный, High: 1 · Medium: 2 (оба в скоупе)\n\n## Вердикт\n\n**Вердикт: зелёный · заход r2 · High: 0 · Medium: 0**\n';
  assert.equal(parseVerdict(retold), 'зелёный');
  assert.deepEqual(parseCounts(retold), { high: 0, medium: 0 });
  // Без строки счётчика — по заголовкам: секция с нумерованными пунктами считается по пунктам.
  const headings = '### High (блокирует)\n\n**H1. один**\n\n**H2 — два**\n\n### Medium (в скоупе)\n\nтекст без номера\n\n### Low — нет\n';
  assert.deepEqual(parseCounts(headings), { high: 2, medium: 1 });
});

test('#635 r2: находки читаются из живых форматов заголовков (CODE-REVIEW-639-r1, 637-r1, 162-r1, 141-r1)', () => {
  const doc = [
    '### Medium (в скоупе — чинится в этой же ветке)',
    '',
    '**M1. Новая запись `smoke-links.mjs` для `smoke_space_settings_form.mjs`',
    'ничего не связывает**',
    '### Medium (в скоупе задачи) — ложный «—» вместо настоящего «0 ч» в медианах',
    '## Находка 1 (High, в скоупе) — калибровка мимо своего этажа',
    'тело',
    '### [High] Живой rubber-band превью не рисуется вовсе',
    '### Low L1 — ветки live/ambiguous без мутанта',
    '### Low — не найдено',
    '### High — нет',
  ].join('\n');
  assert.deepEqual(parseFindings(doc), [
    'Новая запись smoke-links.mjs для smoke_space_settings_form.mjs',
    'ложный «—» вместо настоящего «0 ч» в медианах',
    'калибровка мимо своего этажа',
    'Живой rubber-band превью не рисуется вовсе',
    'ветки live/ambiguous без мутанта',
  ]);
  assert.deepEqual(parseCounts(doc), { high: 2, medium: 2 });
});

test('#635 r2: файлы из находок попадают в индекс — «что находили по файлу X» отвечает grep', () => {
  const doc = '### Medium (в скоупе) — подпись переносится\n\nВ `src/form-kit.ts:412` и `test/form-kit.test.mjs` … `src/form-kit.ts:420-431`.\n\n## Что проверено\n\n`src/other.ts` не считается.\n';
  assert.deepEqual(parseFiles(doc), ['src/form-kit.ts', 'test/form-kit.test.mjs']);
  const entry = indexEntry('CODE-REVIEW-594-r1.md', doc);
  const md = renderIndex({ entries: [entry] });
  assert.match(md, /\| Находки \| Файлы \|/);
  assert.match(md, /`src\/form-kit\.ts` `test\/form-kit\.test\.mjs` \|$/m);
  assert.equal(md.split('\n').filter((l) => l.includes('form-kit')).length >= 1, true);
});
