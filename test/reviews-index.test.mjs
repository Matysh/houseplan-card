// #635: индекс ревью — одна строка на документ, детерминированно, 100 % каталога.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  INDEX_FILE, buildIndex, collectEntries, commitIfStale, indexEntry, parseCounts, parseDocName, parseFiles, parseFindings, parseVerdict, renderIndex,
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

// r2 #635 H1: закоммиченный INDEX.md обязан совпадать с пересборкой — иначе
// документы, приехавшие ребейзом, невидимы через индекс. Гейт — шаг Validate
// `reviews-index --check` на push в dev (см. комментарий в validate.yml, почему
// не на issue-ветках: их переписывает конвейер из ветки по умолчанию, и его
// коммиты индекс ветки знать не обязан). Свежесть держит `--commit-if-stale`
// после каждого ребейза конвейера; здесь — свидетель на проводке.
test('#635 r3: свежесть индекса судится на dev, конвейер пересобирает индекс после своих ребейзов', () => {
  const validate = readFileSync(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  const step = validate.slice(validate.indexOf('id: reviews_index'), validate.indexOf('id: workflow_sync'));
  assert.match(step, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/dev'/);
  assert.match(step, /run: node scripts\/reviews-index\.mjs --dir=docs\/reviews --check/);
  assert.match(validate, /REVIEWS_INDEX: \$\{\{ steps\.reviews_index\.outcome \}\}/);
  assert.match(validate, /\[ "\$REVIEWS_INDEX" = "skipped" \] \|\| check "индекс ревью совпадает с каталогом" "\$REVIEWS_INDEX"/);
});

test('#635 конвейер пересобирает индекс тем же коммитом, что и документ ревью', () => {
  const wf = new URL('../.github/workflows/_process.yml', import.meta.url);
  const text = readFileSync(wf, 'utf8');
  assert.match(text, /node scripts\/reviews-index\.mjs --dir=docs\/reviews\n\s+git add -- docs\/reviews\/INDEX\.md/);
  // r2 H1: после приведения ветки к dev индекс пересобирается коммитом
  // конвейера до фиксации материала; при слиянии — то же в merge-candidate.
  const rebase = text.slice(text.indexOf('- name: Привести ветку к dev'), text.indexOf('- name: Зафиксировать SHA материала ревью'));
  assert.match(rebase, /node scripts\/reviews-index\.mjs --dir=docs\/reviews --commit-if-stale --issue="\$NUM"/);
  assert.match(rebase, /NUM: \$\{\{ github\.event\.issue\.number \}\}/);
  const merge = readFileSync(new URL('../scripts/merge-candidate.mjs', import.meta.url), 'utf8');
  assert.match(merge, /REVIEWS_INDEX_SCRIPT, '--dir=docs\/reviews', '--commit-if-stale'/);
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
