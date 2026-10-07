// #635: индекс ревью — одна строка на документ, детерминированно, 100 % каталога.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  INDEX_FILE, assertAllDocumentsIndexed, buildIndex, collectEntries, commitIfStale, indexEntry, parseCounts, parseDocName, parseFiles, parseFindings, parseVerdict, renderIndex,
} from '../scripts/reviews-index.mjs';

test('#635 имена документов: этап, issue, раунд; INDEX и чужое — вне схемы', () => {
  assert.deepEqual(parseDocName('CODE-REVIEW-600-r2.md'), { stage: 'code', issue: 600, round: 2, suffix: null });
  assert.deepEqual(parseDocName('SPEC-REVIEW-7-r1.md'), { stage: 'spec', issue: 7, round: 1, suffix: null });
  assert.deepEqual(parseDocName('CODE-REVIEW-issue-5.md'), { stage: 'code', issue: 5, round: null, suffix: null });
  assert.deepEqual(parseDocName('RELEASE-REVIEW-v1.78.0.md'), {
    stage: 'release', issue: null, round: null, suffix: null, tag: 'v1.78.0',
  });
  assert.equal(parseDocName('RELEASE-REVIEW-v1.78.0-beta.1.md'), null);
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

test('#811 AC2: colour tokens are standalone in every verdict fallback', async (t) => {
  for (const token of ['validate-red', 'infrared', 'green-light', 'red2', 'red_flag', 'некрасный', 'красныйтекст']) {
    await t.test(token, () => {
      for (const text of [
        `Verdict: ${token} was returned.`,
        `Verdict: \`${token}\` was returned.`,
        `The verdict mentions ${token}.`,
        `## Вердикт\n\n${token}.`,
        `Получен ${token} вердикт.`,
      ]) assert.equal(parseVerdict(text), '—', text);
    });
  }
  for (const text of ['Вердикт: красный', 'Verdict: red', 'Вердикт: 🟥 **красный**',
    'Verdict: _red_', 'Verdict: __red__', '- Вердикт конвейера: `red` · High 1',
    '## Вердикт\n\n**Red**.', 'Получен **red** вердикт.']) {
    assert.equal(parseVerdict(text), 'красный', text);
  }
});

test('#811 AC2/AC3: quoted and retold text cannot supply any fallback verdict or count', async (t) => {
  const foreignBodies = [
    'По результатам: вердикт красный, High: 1 · Medium: 3.', // mention fallback
    'Получен **красный вердикт**.', // tail fallback
    'Всего High: 1, Medium: 3.', // unique-count fallback
    '### High-1 — чужая находка\n\nВ `src/foreign.ts`.', // heading fallback
    'Итог: High 1 · Medium 3 · Low 0', // release summary fallback
  ];
  for (const [i, body] of foreignBodies.entries()) {
    await t.test(`fallback ${i + 1}`, () => {
      const own = '## Проверено (r2)\n\nЗамечаний к материалу здесь не сформулировано.\n';
      const retold = `## Закрытие раунда r1\n\n${body}\n`;
      const quoted = `## Цитата\n\n${body.split('\n').map((line) => `> ${line}`).join('\n')}\n`;
      for (const other of [retold, quoted]) {
        for (const sections of [[other, own], [own, other]]) {
          // The filename supplies the round: a generic title must not hide our r2 section.
          const entry = indexEntry('CODE-REVIEW-900-r2.md', ['# Ревью', ...sections].join('\n'));
          assert.equal(entry.verdict, '—');
          assert.deepEqual([entry.high, entry.medium, entry.findings, entry.files], [0, 0, [], []]);
        }
      }
    });
  }
});

test('#811 AC3: indexEntry keeps only this round’s findings/files when retellings move', () => {
  const own = '## Находки (r2)\n\n### Medium-1 — собственная находка\n\nВ `src/own.ts:12`.\n';
  const retold = '## Унаследовано из r1\n\n### High-2 — старая находка\n\nВ `src/old.ts`.\n';
  const quoted = '## Цитата\n\n> ### High-3 — цитата\n> В `src/quoted.ts`.\n';
  for (const sections of [[own], [retold, own, quoted], [quoted, own, retold]]) {
    const entry = indexEntry('CODE-REVIEW-900-r2.md', ['# Ревью', ...sections].join('\n'));
    assert.deepEqual([entry.high, entry.medium, entry.findings, entry.files],
      [0, 1, ['собственная находка'], ['src/own.ts']]);
  }
});

test('#811 AC3: «Находка Medium-1» supplies severity, titles and paths (SPEC-REVIEW-662-r3)', () => {
  // Excerpts from the real r3; no summary counts, so headings must supply them too.
  // This is quoted review data, not a runtime read of the demo documentation.
  const standReadme = ['demo', 'stand', 'README.md'].join('/');
  const doc = [
    '# SPEC-REVIEW-662-r3',
    '### Находка Medium-1 — радиус по умолчанию: ТЗ дизайнера противоречит решению 12',
    'В `TZ-issue-662-LED-strips.md` и `docs/design/662-led-strips/README.md`.',
    '### Находка Medium-2 — AC14 и раздел «Скоуп» называют документы, удалённые #679',
    `В \`docs/TESTING-DEMO.md\` и \`${standReadme}\`.`,
  ].join('\n');
  const entry = indexEntry('SPEC-REVIEW-662-r3.md', doc);
  assert.deepEqual([entry.high, entry.medium], [0, 2]);
  assert.deepEqual(entry.findings, [
    'радиус по умолчанию: ТЗ дизайнера противоречит решению 12',
    'AC14 и раздел «Скоуп» называют документы, удалённые #679',
  ]);
  assert.deepEqual(entry.files, ['TZ-issue-662-LED-strips.md', 'docs/design/662-led-strips/README.md',
    'docs/TESTING-DEMO.md', standReadme]);
});

test('#811 AC3/AC4: archive 403-r2 cannot inherit High 1; ambiguous 239-r2/43-r2 stay unknown', () => {
  const read = (path) => readFileSync(new URL(`../legacy/reviews/${path}`, import.meta.url), 'utf8');
  const fixed = indexEntry('SPEC-REVIEW-403-r2.md', read('v1.70.0/SPEC-REVIEW-403-r2.md'));
  assert.equal(fixed.verdict, 'зелёный');
  assert.deepEqual([fixed.high, fixed.medium], [0, 0]);
  for (const [tag, name] of [['v1.68.0', 'SPEC-REVIEW-239-r2.md'], ['v1.70.0', 'SPEC-REVIEW-43-r2.md']]) {
    assert.equal(indexEntry(name, read(`${tag}/${name}`)).verdict, '—', name);
  }
});

test('#635 счётчики и находки', () => {
  assert.deepEqual(parseCounts('Вердикт: жёлтый · High: 1 · Medium: 3'), { high: 1, medium: 3 });
  assert.deepEqual(parseCounts('Итог: High 2 · Medium 4 · Low 1'), { high: 2, medium: 4 });
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
    writeFileSync(join(dir, 'RELEASE-REVIEW-v1.78.0.md'), '# Ревью линии\nИтог: High 1 · Medium 2 · Low 0\n### High — риск линии\n');
    writeFileSync(join(dir, 'INDEX.md'), 'старый индекс');
    writeFileSync(join(dir, 'notes.md'), 'постороннее');
    mkdirSync(join(dir, 'legacy'));
    writeFileSync(join(dir, 'legacy', 'CODE-REVIEW-1-r1.md'), 'Вердикт: красный\n');
    const { entries, skipped } = collectEntries(dir);
    assert.equal(entries.length, 5);
    assert.deepEqual(skipped, ['notes.md']);
    assert.doesNotThrow(() => assertAllDocumentsIndexed({ skipped: [] }));
    assert.throws(() => assertAllDocumentsIndexed({ skipped }), /вне схемы имён: notes\.md/);
    const md = buildIndex(dir);
    assert.equal(md, buildIndex(dir), 'детерминирован');
    assert.match(md, /Документов: 5, issue: 2/);
    const rows = md.split('\n').filter((l) => l.startsWith('| #'));
    assert.deepEqual(rows.map((r) => r.split('|')[2].trim()), [
      '[CODE-REVIEW-601-r1.md](CODE-REVIEW-601-r1.md)',
      '[SPEC-REVIEW-600-r1.md](SPEC-REVIEW-600-r1.md)',
      '[CODE-REVIEW-600-r1.md](CODE-REVIEW-600-r1.md)',
      '[CODE-REVIEW-600-r2.md](CODE-REVIEW-600-r2.md)',
    ], 'новые issue сверху; внутри issue — ТЗ, затем код по раундам');
    assert.match(md, /\| #600 \| \[CODE-REVIEW-600-r1\.md\][^\n]*\| code · r1 \| 🟡 жёлтый \| 0 \| 4 \| Первая; Вторая \|/);
    assert.match(md, /\| #601 \|[^\n]*⚪ — \|/);
    assert.match(md, /\| линия v1\.78\.0 \| \[RELEASE-REVIEW-v1\.78\.0\.md\][^\n]*\| ревью линии · — \| [^|]* \| 1 \| 2 \|/);
    assert.match(md, /Вне схемы имён[^\n]*`notes\.md`/);
    assert.ok(!md.includes('INDEX.md](INDEX.md)'), 'индекс не индексирует себя');
    assert.equal(indexEntry('INDEX.md', 'x'), null);
    assert.equal(renderIndex({ entries: [] }).includes('Документов: 0'), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#670 CLI --strict принимает ревью линии и отклоняет неизвестное имя до записи индекса', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-reviews-index-strict-'));
  const script = fileURLToPath(new URL('../scripts/reviews-index.mjs', import.meta.url));
  const output = join(dir, INDEX_FILE);
  const run = () => spawnSync(process.execPath, [script, `--dir=${dir}`, `--output=${output}`, '--strict'], { encoding: 'utf8' });
  try {
    writeFileSync(join(dir, 'RELEASE-REVIEW-v1.78.0.md'), 'Итог: High 1 · Medium 2 · Low 0\n');
    const accepted = run();
    assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
    assert.match(readFileSync(output, 'utf8'), /\| линия v1\.78\.0 \|/);

    writeFileSync(join(dir, 'notes.md'), 'неизвестный документ\n');
    const before = readFileSync(output, 'utf8');
    const rejected = run();
    assert.notEqual(rejected.status, 0, 'неизвестное имя обязано остановить публикацию');
    assert.match(rejected.stderr, /вне схемы имён: notes\.md/);
    assert.equal(readFileSync(output, 'utf8'), before, 'strict падает до перезаписи индекса');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#635 живой каталог docs/reviews: индекс свеж и покрывает все документы', () => {
  const { entries, skipped } = collectEntries(fileURLToPath(new URL('../docs/reviews/', import.meta.url)));
  assert.equal(skipped.length, 0, `вне схемы имён: ${skipped.join(', ')}`);
  // #682: выпущенные линии уезжают в legacy/reviews/<тег>/ — здесь только
  // текущая линия, и её размер не константа. Пустой каталог — тоже поломка.
  assert.ok(entries.length > 0);
  const recognised = entries.filter((e) => e.verdict !== '—').length;
  assert.ok(recognised / entries.length > 0.9, `вердикт распознан у ${recognised} из ${entries.length}`);
});

// r2 #635 H1: закоммиченный INDEX.md обязан совпадать с пересборкой — иначе
// документы, приехавшие ребейзом, невидимы через индекс. Гейт — шаг Validate
// `reviews-index --check` на push в dev (см. комментарий в validate.yml, почему
// не на issue-ветках: их переписывает конвейер из ветки по умолчанию, и его
// коммиты индекс ветки знать не обязан). С #657 ветка задачи индекс не несёт
// вовсе; свежесть dev держит `--commit-if-stale` слияния кандидата.
test('#635 r3: свежесть индекса судится на dev, конвейер пересобирает индекс после своих ребейзов', () => {
  const validate = readFileSync(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  const step = validate.slice(validate.indexOf('id: reviews_index'), validate.indexOf('id: workflow_sync'));
  assert.match(step, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/dev'/);
  assert.match(step, /run: node scripts\/reviews-index\.mjs --dir=docs\/reviews --check/);
  assert.match(validate, /REVIEWS_INDEX: \$\{\{ steps\.reviews_index\.outcome \}\}/);
  assert.match(validate, /\[ "\$REVIEWS_INDEX" = "skipped" \] \|\| check "индекс ревью совпадает с каталогом" "\$REVIEWS_INDEX"/);
});

test('#635/#657 (1б): индекс пересобирается только коммитами, идущими в dev', () => {
  const wf = new URL('../.github/workflows/_process.yml', import.meta.url);
  const text = readFileSync(wf, 'utf8');
  // Публикация документа: индекс — тем же коммитом, только если цель — dev
  // (ревью ТЗ). В ветку задачи — один документ. Скрипт — из снимка dev (#749).
  assert.match(text, /if \[ -f "\$doc" \] && \[ "\$target" = "dev" \]; then\n\s+node "\$TOOLS\/scripts\/reviews-index\.mjs" --dir=docs\/reviews\n\s+git add -- docs\/reviews\/INDEX\.md/);
  // Приведение ветки к dev индекс больше не коммитит: ветка задачи его не несёт.
  const rebase = text.slice(text.indexOf('- name: Привести ветку к dev'), text.indexOf('- name: Зафиксировать SHA материала ревью'));
  assert.doesNotMatch(rebase, /reviews-index\.mjs/, 'в ветке задачи индекс не пересобирается (#657)');
  // Слияние кандидата в dev — единственная точка, где индекс задачи догоняет каталог.
  const merge = readFileSync(new URL('../scripts/merge-candidate.mjs', import.meta.url), 'utf8');
  // #811: the trusted helper runs the accepted tree's generator in isolation;
  // the tools snapshot must not generate an index with its older parser.
  assert.match(merge, /import \{ commitCandidateReviewsIndex \} from '\.\/candidate-reviews-index\.mjs'/);
  assert.match(merge, /commitCandidateReviewsIndex\(/);
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

// #779: раздел «Закрытие раунда r<N−1>» (§2.10) пересказывает вердикт прошлого
// раунда строкой, которая тоже начинается с «Вердикт». Своя — только
// «Вердикт: цвет» (двоеточие сразу после слова); счётчики — из своей строки
// или итоговой сводки, а не из пересказа. Фикстура — по SPEC-REVIEW-662-r3.
test('#779 пересказ «Вердикт rN — цвет» прошлого раунда не свой вердикт (SPEC-REVIEW-662-r3)', () => {
  const doc = [
    '# SPEC-REVIEW-662-r3',
    '',
    '- **Заход:** r3 · блокирующих циклов израсходовано 1 из 4 (потрачен r1; r2 —',
    '  зелёный, бюджет не увеличивает, PROCESS.md §4)',
    '',
    '## Закрытие раунда r2',
    '',
    'Вердикт r2 — зелёный, находок не было (High: 0, Medium: 0). Закрывать нечего;',
    'раздел ведётся для формы требования §2.10.',
    '',
    '## Разбор по дельте (правки 01.10)',
    '',
    '### Находка Medium-1 — радиус по умолчанию: ТЗ дизайнера противоречит решению 12',
    '',
    'текст',
    '',
    '### Находка Medium-2 — AC14 и раздел «Скоуп» называют документы, удалённые #679',
    '',
    '## Вывод',
    '',
    'Два Medium **в скоупе задачи**, без отдельного issue.',
    '',
    'High: 0 · Medium: 2 (обе в скоупе) · Low: 0.',
    '',
    '**Вердикт: жёлтый.**',
    '',
    '---',
    '',
    '<!-- material-anchors: сгенерировано конвейером (#414) -->',
    '',
    '## Материал раунда',
    '',
    '- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`',
  ].join('\n');
  assert.equal(parseVerdict(doc), 'жёлтый');
  assert.deepEqual(parseCounts(doc), { high: 0, medium: 2 });
  const md = renderIndex({ entries: [indexEntry('SPEC-REVIEW-662-r3.md', doc)] });
  assert.match(md, /\| #662 \| \[SPEC-REVIEW-662-r3\.md\][^\n]*\| spec · r3 \| 🟡 жёлтый \| 0 \| 2 \|/);
  // Английская форма и пересказ с двоеточием после номера раунда (legacy SPEC-REVIEW-384-r2).
  assert.equal(parseVerdict('Verdict r1 — green\n\nVerdict: **red** · cycle r2/4'), 'красный');
  const legacy = '- Вердикт r1: жёлтый, High: 0, Medium: 1 (в скоупе) — документ r1\n\n## Вердикт\n\nЗелёный. High: 0. Medium: 0.\n';
  assert.equal(parseVerdict(legacy), 'зелёный');
  assert.deepEqual(parseCounts(legacy), { high: 0, medium: 0 });
  // Пересказ не перебивает и упоминание: без своей строки и секции — «—», а не чужой цвет.
  assert.equal(parseVerdict('Вердикт r1: жёлтый · High 0 · Medium 1.\n\nRec: готово.\n'), '—');
});

// #779: двоеточие — приоритет, а не единственная форма своей строки: машинная
// строка конвейера и «Вердикт зелёный; …» без двоеточия у старых документов
// остаются своими (CODE-REVIEW-728-r1, legacy SPEC-REVIEW-476-r2).
test('#779 своя строка без «Вердикт:»: строка конвейера и «Вердикт цвет» в начале строки', () => {
  const machine = 'Вердикт прошлого раунда — жёлтый, пересказ в шапке.\nПризнаки (`validate-red`) — без вердикта.\n\n## Материал раунда\n\n- Вердикт конвейера: `green` · High 0\n';
  assert.equal(parseVerdict(machine), 'зелёный');
  const lead = '- **Предыдущий раунд:** SPEC-REVIEW-476-r1.md, вердикт жёлтый\n\n## Вывод\n\nВердикт зелёный; бюджет не расходуется.\n';
  assert.equal(parseVerdict(lead), 'зелёный');
  // Сводка — последний абзац, начинающийся со счётчика; продолжение буллета шапки — не сводка.
  const summary = 'High: 0. Medium: 0 (все три Medium из r1 закрыты).\n\n- Унаследовано: r1 жёлтый,\n  High: 0, Medium: 3 (закрыты выше)\n';
  assert.deepEqual(parseCounts(summary), { high: 0, medium: 0 });
});

// r1 #779 M1: источник счётчиков выбирается по структуре документа, а не по
// позиции. Порядок секций не задан: «## Вердикт» бывает и до «## Унаследовано
// из r1» (SPEC-REVIEW-728-r2), и после (774-r2, 806-r2). Секция-пересказ
// («Закрытие раунда», «Унаследовано», заголовок с чужим rN), цитата и блок кода —
// не собственный текст, даже если абзац в них начинается с `High:`.
test('#779 r2: счётчики и вердикт — из собственного текста, не из секции-пересказа, при любом порядке секций', () => {
  const inherited = ['## Унаследовано из r1', '', 'Принято без проверки:', '', '- High: 2, Medium: 1 (закрыто в r1)', ''];
  // Вердикт после «Унаследовано» (774-r2, 806-r2); своя сводка — раньше пересказа.
  const after = ['# CODE-REVIEW-900-r2', '', '## Вывод', '', 'High: 0 · Medium: 0.', '', ...inherited, '## Вердикт', '', 'Зелёный.'].join('\n');
  assert.equal(parseVerdict(after), 'зелёный');
  assert.deepEqual(parseCounts(after), { high: 0, medium: 0 });
  // Вердикт до «Унаследовано» (728-r2): сводка рядом со своей строкой вердикта, пересказ — после.
  const before = [
    '# CODE-REVIEW-900-r2', '', '## Вывод', '', 'High: 0 · Medium: 2 (обе в скоупе).', '', '**Вердикт: жёлтый.**', '',
    '## Закрытие раунда r1', '', 'Вердикт: зелёный · заход r1 · High: 0 · Medium: 0', '', 'High: 3 · Medium: 1 — находки r1, закрыты.', '',
  ].join('\n');
  assert.equal(parseVerdict(before), 'жёлтый');
  assert.deepEqual(parseCounts(before), { high: 0, medium: 2 });
  // Пересказ в форме шаблона §7.2 внутри секции-пересказа — не своя строка, даже без своей строки ниже.
  const templated = '# CODE-REVIEW-900-r2\n\n## Закрытие раунда r1\n\nВердикт: красный · заход r1 · High: 1 · Medium: 0\n\n## Итог\n\nЗелёный. High: 0. Medium: 0.\n';
  assert.equal(parseVerdict(templated), 'зелёный');
  assert.deepEqual(parseCounts(templated), { high: 0, medium: 0 });
  // Заголовок с номером СВОЕГО раунда — свой текст; номер раунда — из имени документа или из заголовка `# …-rN`.
  const ownRound = '# CODE-REVIEW-900-r2\n\n## Находки (r2)\n\nHigh: 0 · Medium: 1.\n\n## Дельта r1 → r2\n\nHigh: 4 · Medium: 4 (r1).\n';
  assert.deepEqual(parseCounts(ownRound), { high: 0, medium: 1 });
  assert.deepEqual(parseCounts(ownRound.replace('# CODE-REVIEW-900-r2\n', ''), { round: 2 }), { high: 0, medium: 1 });
  // Цитата — не сводка документа; `#` в блоке кода — не заголовок, блок не прячет свою сводку.
  const quoted = '# CODE-REVIEW-900-r2\n\n## Вывод\n\nHigh: 0 · Medium: 1.\n\n```\n# Закрытие раунда r1\n```\n\nHigh: 0 · Medium: 1 → в задаче\n\n> Комментарий r1 владельцу:\nHigh: 5 · Medium: 5\n';
  assert.deepEqual(parseCounts(quoted), { high: 0, medium: 1 });
  // Свой шаблон §7.2 в блоке кода — свой вердикт (SPEC-REVIEW-288-r1).
  assert.equal(parseVerdict('## Вердикт\n\nОдна Medium-находка.\n\n```\nВердикт: жёлтый · заход r1 · High: 0 · Medium: 1\n```\n'), 'жёлтый');
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
    'Новая запись smoke-links.mjs для smoke_space_settings_form.mjs ничего не связывает',
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

// r2 #635 M1: у секции без заголовка находки брался хвост перенесённого
// буллета («пусто). Не эскалирую…», CODE-REVIEW-485-r4). Абзац склеивается,
// маркер снимается, «не найдено» и служебные скобки — не находка.
test('#635 r2: первый абзац секции берётся целиком, а не хвост перенесённого буллета', () => {
  const doc = [
    '### Low',
    '',
    '- Нет golden-сцены для радара (`find demo/golden` — по-прежнему',
    '  пусто). Не эскалирую третий раунд подряд.',
    '',
    '### Medium',
    '',
    '(унаследовано из r1/r2, перепроверено заново)',
    '',
    'High не найдено. Medium вне скоупа не найдено — единственный M1 внутри.',
    '',
    '### Medium (в скоупе)',
    '',
    '**M1.** Токен `E2E_DISPATCH_TOKEN` scoped только',
    'на соседний репозиторий.',
  ].join('\n');
  const findings = parseFindings(doc);
  assert.equal(findings.length, 2);
  assert.match(findings[0], /^Нет golden-сцены для радара \(find demo\/golden — по-прежнему пусто\)\. Не эскалирую/);
  assert.equal(findings[1], 'Токен E2E_DISPATCH_TOKEN scoped только на соседний репозиторий');
});

test('#635 r2: --commit-if-stale пересобирает индекс и коммитит его только при расхождении', () => {
  const repo = mkdtempSync(join(tmpdir(), 'hp-reviews-commit-'));
  const git = (args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  try {
    git(['init', '-q']);
    const dir = join(repo, 'docs', 'reviews');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'CODE-REVIEW-1-r1.md'), 'Вердикт: **зелёный** · High: 0 · Medium: 0\n');
    writeFileSync(join(dir, INDEX_FILE), buildIndex(dir));
    git(['add', '-A']);
    git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base']);
    const base = git(['rev-parse', 'HEAD']).stdout.trim();
    const fresh = commitIfStale({ dir, issue: '635', git });
    assert.deepEqual(fresh, { changed: false, sha: null });
    assert.equal(git(['rev-parse', 'HEAD']).stdout.trim(), base, 'свежий индекс — коммита нет');
    // «Ребейз» принёс новый документ: индекс устарел.
    writeFileSync(join(dir, 'CODE-REVIEW-2-r1.md'), 'Вердикт: **жёлтый** · High: 0 · Medium: 1\n### M1 — x\n');
    git(['add', '-A']);
    git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'rebased doc']);
    const stale = commitIfStale({ dir, issue: '635', git });
    assert.equal(stale.changed, true);
    assert.equal(stale.sha, git(['rev-parse', 'HEAD']).stdout.trim());
    assert.equal(git(['status', '--porcelain']).stdout.trim(), '', 'рабочая копия чистая');
    const message = git(['log', '-1', '--format=%B']).stdout;
    assert.match(message, /^docs\(reviews\): индекс после сдвига каталога \(#635\)/);
    assert.match(message, /Issue: #635\nUser-Visible: no/);
    assert.deepEqual(git(['diff', '--name-only', 'HEAD~1', 'HEAD']).stdout.trim().split('\n'), ['docs/reviews/INDEX.md']);
    assert.match(readFileSync(join(dir, INDEX_FILE), 'utf8'), /CODE-REVIEW-2-r1\.md/);
    assert.ok(existsSync(join(dir, INDEX_FILE)));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
