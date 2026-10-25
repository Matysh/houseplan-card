// #634: ролевые конспекты PROCESS.md не расходятся с каноном.
//
// `docs/process/AUTHOR.md` и `docs/process/REVIEWER.md` — вход автора и
// ревьюера вместо полного PROCESS.md. Конспект, который тихо разошёлся с
// каноном, хуже его отсутствия: агент действует по устаревшей выжимке. Поэтому
// (AC2) каждый пункт конспекта ссылается на существующий раздел канона, а
// ключевые правила (перечень ниже) записаны в конспекте теми же словами, что в
// каноне, и именно в том разделе, на который пункт ссылается. Меняется
// формулировка в PROCESS.md — краснеет этот тест, и конспект правится тем же
// коммитом.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { headings, markdownLinks, sectionText } from '../scripts/md-anchors.mjs';
import { findStep } from './helpers/workflow-step.mjs';
import { MUTANTS } from '../scripts/mutation-registry.mjs';
import { checkMutationRegistry, definitionProblems } from '../scripts/mutation-registry-check.mjs';
import { classifyCommandResult, isProofOutcome } from '../scripts/mutation-guard-outcome.mjs';
import { findingsPolicy } from '../scripts/review-findings-policy.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
const DIGESTS = ['docs/process/AUTHOR.md', 'docs/process/REVIEWER.md'];
const CANON = 'PROCESS.md';
// Сравнение формулировок: без Markdown-выделения, пробелы схлопнуты, регистр
// не важен (пункт конспекта начинается с заглавной там, где в каноне середина фразы).
const norm = (text) => text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Пункты верхнего уровня: строка `- ` и её продолжения с отступом. */
function topLevelBullets(text) {
  const bullets = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) { current = [line]; bullets.push(current); continue; }
    if (current && /^\s+\S/.test(line)) { current.push(line); continue; }
    current = null;
  }
  return bullets.map((lines) => lines.join('\n'));
}

// Ключевые правила: формулировка, дословная в каноне и в конспекте, и раздел
// канона, где она записана. Отбор — то, нарушение чего дороже всего стоило
// процессу: вход в код, трек, вопросы владельцу, трейлеры, доказательство
// защитных AC, гейты, дисциплина хендоффа и формат вердикта.
const KEY_RULES = {
  'docs/process/AUTHOR.md': [
    ['119-авторский-changelog-стабильного-релиза', 'Changelog пишет агент, не скрипт'],
    ['119-авторский-changelog-стабильного-релиза', 'Если крупных фич нет — без списка: вводный абзац и короткий абзац исправлений'],
    ['1-основное-правило', 'Изменение продуктового кода без issue запрещено'],
    ['1-основное-правило', 'ни одного файла класса A'],
    ['1-основное-правило', 'D сильнее A'],
    ['3-правила', 'Ровно одна метка статуса'],
    ['3-правила', 'Статус меняется до действия, а не после'],
    ['5-треки-ship-show-ask--метка-владельца', 'Метка владельца главнее критериев'],
    ['5-треки-ship-show-ask--метка-владельца', 'ожидаемое поведение уже зафиксировано'],
    // #707: трек подтверждает строка владельца, метка без неё — предложение.
    ['5-треки-ship-show-ask--метка-владельца', 'строкой `Трек: <ship|show|ask> — решение владельца` в начале строки'],
    ['5-треки-ship-show-ask--метка-владельца', 'Метка без такой строки — предложение'],
    ['5-треки-ship-show-ask--метка-владельца', 'Агент эту строку не пишет никогда'],
    ['5-треки-ship-show-ask--метка-владельца', 'до `S5` запрещён push всей ветки, включая тесты и документы'],
    ['71-цепочка', 'Владельцу задаются только продуктовые вопросы'],
    ['71-цепочка', 'Ручная dev/GPU-приёмка владельцем добровольна'],
    ['71-цепочка', 'issue остаётся в `S3-spec` и получает `blocked`'],
    ['26-в-разработке--реализация', 'каждый коммит с файлами классов A, B или D несёт трейлеры `Issue: #<NN>` и `User-Visible: yes|no`'],
    ['3-правила', '`User-Visible: yes` требует правок в обоих changelog в том же коммите'],
    ['26-в-разработке--реализация', 'шесть классов риска'],
    ['26-в-разработке--реализация', 'Скоуп не расширяется'],
    ['26-в-разработке--реализация', 'Документация — в том же коммите, что и поведение'],
    ['27-код-ревью', 'Защитный AC доказывается таблицей «чем краснеет»'],
    ['27-код-ревью', 'Пустой третий столбец — находка Medium'],
    ['27-код-ревью', 'Контракты по монолиту — исполнением, не regex по тексту'],
    ['8-гейты', 'Новый код не добавляет `any`'],
    ['8-гейты', '`// any-ok: <конкретная причина>`'],
    ['8-гейты', 'Одно число — один источник'],
    ['8-гейты', 'Полные наборы — предрелизный гейт, а не гейт ревью'],
    ['8-гейты', 'Упавший предрелизный гейт автор чинит и повторно прогоняет'],
    ['3-правила', 'проверено чтением, не исполнением'],
    // #726: исчерпание видно сразу, а не на следующем S7.
    ['4-лимит-циклов-ревью-4', 'вердикт, исчерпавший бюджет, сразу ставит `review-4`'],
    ['104-событийный-конвейер-метка-как-триггер', 'Один хендофф — один пуш'],
    ['104-событийный-конвейер-метка-как-триггер', 'Ветка приводится к `dev` до ревью, а не после'],
    ['104-событийный-конвейер-метка-как-триггер', 'Автор обязан дождаться вердикта, а не заканчивать сессию'],
    ['104-событийный-конвейер-метка-как-триггер', 'После прогона ревью метка меняется всегда'],
    ['72-шаблоны-комментариев', 'Вперёд двигает только зелёный вердикт'],
    ['12-запрещено', 'force-push в `dev`'],
    ['12-запрещено', 'попутные правки «раз уж я здесь»'],
    // #729: черновик track:ask во время ревью ТЗ — исключение из правила №1.
    ['118-черновик-кода-во-время-ревью-тз', 'черновик — возможность, а не обязанность'],
    ['118-черновик-кода-во-время-ревью-тз', 'в ветку черновик попадает только после зелёного ревью ТЗ'],
  ],
  'docs/process/REVIEWER.md': [
    ['71-цепочка', 'Ручная dev/GPU-приёмка владельцем добровольна'],
    ['119-авторский-changelog-стабильного-релиза', 'Changelog пишет агент, не скрипт'],
    ['27-код-ревью', 'Ревьюер ≠ исполнитель'],
    ['24-тз-на-ревью', '`docs/reviews/SPEC-REVIEW-<NN>-r<N>.md`'],
    ['27-код-ревью', '`docs/reviews/CODE-REVIEW-<tag|NN>-r<N>.md`'],
    ['27-код-ревью', 'Ревьюер отвечает за полноту доказательств AC, а не заменяет их исполнение'],
    ['27-код-ревью', 'Независимый поиск дефектов — до авторских выводов'],
    ['27-код-ревью', 'Качество и читаемость входят в ревью'],
    ['27-код-ревью', 'проверено чтением, не исполнением'],
    ['27-код-ревью', 'Защитный AC доказывается таблицей «чем краснеет»'],
    ['27-код-ревью', 'Пустой третий столбец — находка Medium, а не примечание'],
    ['27-код-ревью', '«Тест умеет падать» без названного отрицательного свидетеля доказательством не является'],
    ['27-код-ревью', 'Вердикт привязан к SHA (#312)'],
    ['27-код-ревью', 'новое имя в нём — находка ревью, а не запись в список'],
    ['8-гейты', 'ревьюер обязан перечислить, какие гейты прогнал, какие нет и почему'],
    ['8-гейты', 'какое число в этом диффе видно дважды и один ли у него источник'],
    ['8-гейты', 'Полные наборы — предрелизный гейт, а не гейт ревью'],
    ['210-повторный-раунд-ревью--объём-по-дельте', 'Предмет повторного раунда — дельта, а не задача целиком'],
    ['210-повторный-раунд-ревью--объём-по-дельте', 'Если SHA не резолвится — это не находка, а обычное дело'],
    ['210-повторный-раунд-ревью--объём-по-дельте', 'SHA, мёртвый уже в момент публикации отчёта'],
    ['210-повторный-раунд-ревью--объём-по-дельте', 'раздел «Унаследовано из r<N−1>»'],
    ['210-повторный-раунд-ревью--объём-по-дельте', 'Разбор остаётся полным, если дельта не локальна'],
    ['210-повторный-раунд-ревью--объём-по-дельте', 'Сокращается объём разбора, а не строгость'],
    ['3-правила', 'High блокирует. Medium в скоупе чинится в текущем issue'],
    ['72-шаблоны-комментариев', '`Вердикт: зелёный/жёлтый/красный · заход r<N> · блокирующих циклов K/<лимит> · High: N · Medium: N → в задаче | #… · Документ: docs/reviews/…`'],
    ['72-шаблоны-комментариев', 'Вперёд двигает только зелёный вердикт'],
    ['4-лимит-циклов-ревью-4', 'Зелёный вердикт цикла не образует'],
    ['4-лимит-циклов-ревью-4', 'вердикт, исчерпавший бюджет, сразу ставит `review-4`'],
    ['71-цепочка', 'Технический спор автора и ревьюера решается вердиктом, а не владельцем'],
    ['12-запрещено', 'Medium-находки, оставленные как TODO в документе ревью'],
    // #727: ночное пакетное ревью ship переиспользуется гейтом беты по патч-набору.
    ['117-пакетное-ревью-ship-ночью-и-перед-бетой', 'гейт беты принимает ночной документ при том же патч-наборе'],
    // #729: готовый черновик не довод за непринятое ТЗ.
    ['24-тз-на-ревью', 'ревьюер ТЗ не читает и доводом не считает'],
  ],
};

test('#634 конспект: каждая ссылка ведёт на существующий файл и заголовок', () => {
  for (const digest of DIGESTS) {
    const text = read(digest);
    const links = markdownLinks(text);
    assert.ok(links.some((link) => link.anchor && link.file.endsWith(CANON)), `${digest}: нет ни одной ссылки на раздел ${CANON}`);
    for (const link of links) {
      const target = link.file ? normalize(join(dirname(digest), link.file)).replace(/\\/g, '/') : digest;
      assert.ok(existsSync(join(ROOT, target)), `${digest}: ссылка на несуществующий файл ${link.target}`);
      if (!link.anchor) continue;
      const anchors = new Set(headings(read(target)).map((heading) => heading.anchor));
      assert.ok(anchors.has(link.anchor), `${digest}: нет заголовка ${target}#${link.anchor}`);
    }
  }
});

test('#634 конспект: каждый пункт ссылается на раздел канона (AC2)', () => {
  for (const digest of DIGESTS) {
    const bullets = topLevelBullets(read(digest));
    assert.ok(bullets.length >= 20, `${digest}: подозрительно мало пунктов (${bullets.length})`);
    for (const bullet of bullets) {
      const cited = markdownLinks(bullet).some((link) => link.anchor && link.file.endsWith(CANON));
      assert.ok(cited, `${digest}: пункт без ссылки на раздел ${CANON}:\n${bullet}`);
    }
  }
});

test('#634 конспект: ключевые правила дословно в каноне и в пункте со ссылкой на их раздел', () => {
  const canon = read(CANON);
  for (const [digest, rules] of Object.entries(KEY_RULES)) {
    const bullets = topLevelBullets(read(digest));
    for (const [anchor, phrase] of rules) {
      const section = sectionText(canon, anchor);
      assert.ok(section, `${CANON}: нет раздела #${anchor}`);
      assert.ok(norm(section).includes(norm(phrase)), `${CANON}#${anchor} больше не содержит «${phrase}» — поправьте ${digest}`);
      const owner = bullets.find((bullet) => norm(bullet).includes(norm(phrase)));
      assert.ok(owner, `${digest}: ключевое правило «${phrase}» (${CANON}#${anchor}) пропало из конспекта`);
      assert.ok(markdownLinks(owner).some((link) => link.anchor === anchor),
        `${digest}: пункт с «${phrase}» не ссылается на ${CANON}#${anchor}`);
    }
  }
});

test('#634 конспект: объявляет себя выжимкой, канон — PROCESS.md', () => {
  for (const digest of DIGESTS) {
    const text = norm(read(digest));
    assert.ok(text.includes(norm('Это выжимка, а не канон.')), digest);
    assert.ok(text.includes(norm('при расхождении побеждает он')), digest);
  }
  const canon = norm(read(CANON));
  for (const digest of DIGESTS) assert.ok(canon.includes(norm(digest)), `${CANON} называет ${digest}`);
});

test('#634 промпт ревьюера: конспект вместо пересказа, машинные требования на месте', () => {
  const workflow = read('.github/workflows/_process.yml');
  const prompt = actualReviewPrompt();
  const flat = prompt.replace(/\s+/g, ' ');
  assert.match(flat, /docs\/process\/REVIEWER\.md/, 'ревьюер читает конспект');
  for (const required of [
    'Материал ревью — ровно `${{ needs.prepare.outputs.material_sha }}`',
    'Не делай `git fetch`, `git pull` и `git checkout` на другой коммит',
    'переменной окружения REVIEW_DOC (абсолютный, ВНЕ репозитория)',
    'В репозитории не создавай вручную файлы кода или отчёт ревью',
    'SPEC-REVIEW для этапа spec, CODE-REVIEW для code',
    'Ты НЕ правишь ни ТЗ, ни продуктовый код',
    '«AC · чем доказан · чем краснеет»',
    'пустой третий столбец — находка Medium',
    '«Закрытие раунда r<N-1>»',
    '«Унаследовано из r<N-1>»',
    'какие гейты прогнал, какие нет и почему',
    'outside_findings',
    '${{ needs.prepare.outputs.validated_note }}',
    '${{ needs.prepare.outputs.rebase_note }}',
    'Затем верни JSON по схеме',
  ]) assert.ok(flat.includes(required), `промпт потерял: ${required}`);
  // Правила живут в каноне; промпт, снова набравший пересказ, — возврат к 60–90 k
  // контекста до первого git diff (аудит 22.09). До #634 — 1 642 слова, к #750 —
  // ровно 1 400, после #750 — 1 130: порог прежний, разница — запас.
  const words = prompt.split(/\s+/).filter(Boolean).length;
  assert.ok(words <= 1400, `промпт ревьюера ${words} слов > 1400`);
  // #750 AC1: мёртвая строка мутантов (с #709 `mutants` всегда false) и правило
  // всех треков, которое REVIEWER.md уже несёт, в промпт не возвращаются.
  assert.doesNotMatch(prompt, /needs\.prepare\.outputs\.mutants/, 'промпт читает мёртвый выход mutants');
  assert.doesNotMatch(flat, /Отсутствие мутантов/, 'правило «отсутствие мутантов — не находка» — в REVIEWER.md, не в промпте');
});

// #750 AC2: промпт вместо пересказа ссылается на разделы конспекта — ссылка
// без раздела оставила бы ревьюера без правила, которое промпт больше не несёт.
test('#750 AC2: ссылки промпта на REVIEWER.md ведут в существующие разделы; перенесённое на месте', () => {
  const workflow = read('.github/workflows/_process.yml');
  const prompt = actualReviewPrompt();
  const flat = prompt.replace(/\s+/g, ' ');
  const reviewer = read('docs/process/REVIEWER.md');
  const sections = new Set(headings(reviewer).filter((h) => h.level === 2).map((h) => h.text));
  const cited = [...flat.matchAll(/docs\/process\/REVIEWER\.md, «([^»]+)»/g)].map((m) => m[1]);
  for (const name of ['Трек show', 'Повторный раунд', 'Объём гейтов', 'Находки и вердикт']) {
    assert.ok(cited.includes(name), `промпт не ссылается на «${name}»`);
  }
  for (const name of cited) assert.ok(sections.has(name), `REVIEWER.md: нет раздела «## ${name}», на который ссылается промпт`);
  // Запрет на отдельный issue для Medium в скоупе остаётся в промпте: модель
  // заводит issue сама, и ошибка дорогая.
  assert.ok(flat.includes('отдельный issue НЕ заводится (#202)'), 'промпт потерял запрет на issue для Medium в скоупе');

  const bullets = (anchor) => topLevelBullets(sectionText(reviewer, anchor) ?? '');
  const gates = bullets('объём-гейтов');
  const uncertain = gates.find((bullet) => bullet.includes('НЕОПРЕДЕЛЁННОСТЬ'));
  assert.ok(uncertain, '«Объём гейтов»: нет трёх ответов smoke-select с «НЕОПРЕДЕЛЁННОСТЬ»');
  assert.match(uncertain, /связь не доказана/);
  assert.ok(markdownLinks(uncertain).some((link) => link.file.endsWith('TESTING.md')), 'ответы smoke-select ссылаются на docs/TESTING.md');
  assert.ok(gates.some((bullet) => /инвариант/i.test(bullet) && bullet.includes('непрогнанный гейт')),
    '«Объём гейтов»: нет строки «геометрия без инвариантов в отчёте — непрогнанный гейт»');
  const delta = norm(bullets('повторный-раунд').join('\n'));
  assert.ok(delta.includes(norm('дифф тела issue')), '«Повторный раунд»: дельта ТЗ — дифф тела issue');
  assert.ok(delta.includes(norm('Сомнение в локальности — полный разбор')), '«Повторный раунд»: сомнение — полный разбор');
});

// Read the real Review input scalar, bounded by the parsed workflow step.
// This is deliberately not another copy of the policy or a generic YAML/GHA engine.
function actualReviewPrompt(path = '.github/workflows/_process.yml') {
  const workflow = read(path);
  const step = findStep(workflow, { name: 'Подготовить native review prompt' });
  const source = workflow.split('\n').slice(step.line - 1, step.last).join('\n');
  const match = /^          REVIEW_PROMPT_TEXT: \|\n((?:^            .*\n|^\s*\n)*)/m.exec(source);
  assert.ok(match, 'Native Review has the supported literal prompt scalar');
  return match[1].replace(/^ {12}/gm, '');
}

function promptFixture(stage, track, findingsRaw = '') {
  const values = { 'github.event.issue.number': '905', 'runner.temp': '/tmp/hp-review-fixture',
    'fromJSON(inputs.source_event || toJSON(github.event)).issue.number': '905', 'github.repository': 'owner/repo',
    'needs.guard.outputs.stage': stage, 'needs.guard.outputs.cycle': '1',
    'needs.guard.outputs.spent': '0', 'needs.guard.outputs.limit': '4',
    'needs.prepare.outputs.material_sha': 'a'.repeat(40),
    'needs.prepare.outputs.findings_policy_snapshot': JSON.stringify(findingsPolicy(findingsRaw,
      { repo: 'owner/repo', issue: 905, stage, round: 1 })) };
  const emptyNotes = ['rebase_note', 'risk_note', 'route_note', 'validated_note'];
  return actualReviewPrompt().replace(/\$\{\{([\s\S]*?)\}\}/g, (_, raw) => {
    const expression = raw.trim();
    if (expression in values) return values[expression];
    if (expression === "needs.prepare.outputs.track || 'ask'") return track;
    if (emptyNotes.some(name => expression === 'needs.prepare.outputs.' + name)) return '';
    // The unchanged-body fixture legitimately takes the false branch here.
    if (expression.startsWith("needs.prepare.outputs.spec_body_changed == 'true' && format(")) return '';
    const strings = [...expression.matchAll(/'((?:[^']|'')*)'/g)].map(match => match[1].replaceAll("''", "'"));
    if (expression.startsWith("needs.prepare.outputs.track == 'show' && needs.guard.outputs.stage == 'code' &&"))
      return track === 'show' && stage === 'code' ? strings[2] : strings[3];
    if (expression.startsWith("needs.guard.outputs.stage == 'spec' &&"))
      return stage === 'spec' ? strings[1] : track === 'show' ? strings[3] : strings[4];
    assert.fail('Prompt fixture must explicitly handle the actual expression: ' + expression);
  });
}

// These contracts protect review instructions, not a model's ability to find bugs.
test('#1063 task and ship review keep independent analysis ahead of evidence and preserve scoped checks', () => {
  const ship = read('.github/workflows/_ship-review.yml');
  const shipPrompt = actualReviewPrompt('.github/workflows/_ship-review.yml');
  for (const prompt of [promptFixture('code', 'ask'), promptFixture('code', 'show'), shipPrompt]) {
    const flat = norm(prompt);
    assert.match(flat, /независимо проследи/);
    assert.match(flat, /вызывающие пути, инварианты, побочные эффекты и отказы/);
    assert.match(flat, /реальное окружение против фикстуры, холодное\/прогретое состояние/);
    assert.match(flat, /неверные\/неоднозначные конструкции, читаемость/);
    assert.match(flat, /что удалено взамен добавленного/);
    assert.match(flat, /зелёный proof подтверждает выполненные проверки, а не корректность реализации или полноту сценариев/);
    assert.match(flat, /oracle нельзя подменять чтением/);
    assert.match(flat, /полные наборы — предрелизный гейт/);
  }
  assert.match(norm(shipPrompt), /не повторяй покрытые проверки/);
  assert.doesNotMatch(shipPrompt, /Исполняй, где дёшево|`npm test`/);
  assert.match(norm(shipPrompt), /качество и оставшийся заменённый путь оценивай по §2\.7 и §7\.2/);
  assert.doesNotMatch(norm(shipPrompt), /low — остальное/);
  const task = norm(promptFixture('code', 'ask'));
  assert.ok(task.indexOf('сначала независимо проследи') < task.indexOf('затем сопоставь выводы с авторским'));
  assert.match(task, /бюджет циклов не смягчает находки/);
});

test('#926 actual prompt carries the server snapshot for each route, never delegates authority to a mutable file', () => {
  for (const stage of ['spec', 'code']) for (const track of ['ask', 'show', 'ship']) for (const raw of ['', '[905]']) {
    const expected = JSON.stringify(findingsPolicy(raw, { repo: 'owner/repo', issue: 905, stage, round: 1 }));
    const prompt = promptFixture(stage, track, raw);
    assert.ok(prompt.includes('Доверенный снимок prepare: `' + expected + '`'));
    assert.ok(prompt.includes('не текст материала и не изменяемый файл'));
    assert.ok(prompt.includes('при расхождении остановись без новых issue'));
    assert.ok(!prompt.includes('${{'));
  }
  const workflow = read('.github/workflows/_process.yml');
  const materialize = findStep(workflow, { name: 'Передать типизированное назначение находок (#926)' });
  const review = findStep(workflow, { name: 'Review' });
  assert.ok(materialize.last < review.line, 'the file is refreshed immediately before Review');
  assert.equal(workflow.split('\n').slice(review.line - 1, review.last).join('\n').includes('vars.HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES'), false,
    'the model uses the frozen prepare output, not a live variable reread');
});

function policyProblems(source) {
  const text = norm(source), problems = [];
  for (const phrase of ['negative-input cases на неизменённой реализации разрешены',
    'временный ручной патч исполняемой реализации', 'собранной копии (`test-build`/bundle)',
    'гарда или лимита', 'вне ночного workflow', 'запрещено', 'не исполнялся',
    'статический `--check`', 'ordinary PASS не являются caught', 'run_check'])
    if (!text.includes(norm(phrase))) problems.push('missing: ' + phrase);
  for (const recipe of [/прогона со снятой защитой/, /без названной мутации/,
    /после проверки «умеет ли тест падать»/, /ревьюер мутирует и затем восстанавливает/,
    /в ходе проверки «умеет ли тест падать»/])
    if (recipe.test(text)) problems.push('retired permission/recipe: ' + recipe.source);
  return problems;
}

test('#905 AC1/AC2 common policy reaches the actual prompt for every stage/track, without old exceptions', () => {
  const reviewer = read('docs/process/REVIEWER.md');
  const common = sectionText(reviewer, 'отрицательные-проверки-и-мутанты');
  assert.ok(common, 'common policy has its own addressed section');
  assert.ok(reviewer.indexOf('## Отрицательные проверки и мутанты') < reviewer.indexOf('## Ревью ТЗ'));
  assert.doesNotMatch(sectionText(reviewer, 'трек-show'), /Мутанты в разработке/,
    'the common prohibition is not left inside show');
  for (const text of [sectionText(read(CANON), '27-код-ревью'), common, read('docs/TESTING.md')])
    assert.deepEqual(policyProblems(text), []);
  for (const stage of ['spec', 'code']) for (const track of ['ask', 'show', 'ship']) {
    const prompt = promptFixture(stage, track);
    assert.deepEqual(policyProblems(prompt), [], stage + '/' + track);
    assert.ok(prompt.includes('Этап: ' + stage));
    assert.ok(prompt.includes('Трек: ' + track));
    assert.ok(prompt.includes('docs/process/REVIEWER.md,\n«Отрицательные проверки и мутанты»'));
    assert.ok(prompt.includes('Generated outputs обычных build/test допустимы'));
    assert.ok(!prompt.includes('${{'), 'fixture renders every actual expression');
  }
  assert.deepEqual(policyProblems(actualReviewPrompt()), [], 'no conditional legacy exception survives in source');
  const workflow = read('.github/workflows/_process.yml');
  assert.doesNotMatch(norm(workflow), /ревьюер мутирует и затем восстанавливает|в ходе проверки «умеет ли тест падать»/);
  // The #365/#220 isolation is still real, not replaced by a prose ban.
  assert.match(workflow, /git reset -q --hard "origin\/\$target"/);
  assert.match(workflow, /git clean -fdq -e node_modules/);
  assert.match(workflow, /REVIEW_DOC: \$\{\{ runner\.temp \}\}\/review-document\.md/);
  assert.match(workflow, /REVIEW_MAX_TURNS: 150/);
});

test('#905 AC3 ordinary input fixtures and static readiness are not caught execution evidence', () => {
  // Negative INPUT to an unchanged text-contract checker, not a filesystem,
  // implementation, compiled-artifact, budget or guard mutation.
  const ordinary = policyProblems('Для чистых юнитов достаточно прогона со снятой защитой.');
  assert.ok(ordinary.some(problem => problem.startsWith('retired permission/recipe:')));
  const contradictoryInput = actualReviewPrompt() + '\nДля чистых юнитов достаточно прогона со снятой защитой.';
  assert.ok(policyProblems(contradictoryInput).some(problem => problem.startsWith('retired permission/recipe:')),
    'Adding the new rule cannot hide an old permission in the same text input; no model receives this fixture');
  const declared = { id: 'fixture', because: 'ordinary data', guard: 'node --test test/example.test.mjs',
    patches: [{ file: 'src/example.ts', find: 'guard', replace: 'other' }] };
  assert.deepEqual(definitionProblems(declared), []);
  assert.ok(definitionProblems({}).length > 0, 'invalid declaration is an ordinary negative input');
  assert.equal(isProofOutcome({ kind: 'registered', definition: declared }), false);
  const lines = [];
  assert.equal(checkMutationRegistry(MUTANTS, { root: ROOT, log: line => lines.push(line) }), 0);
  assert.ok(lines.some(line => /static-readiness: .* execution=0 caught=unknown/.test(line)));
  assert.equal(isProofOutcome({ kind: 'static-readiness', status: 0 }), false);
  assert.equal(isProofOutcome({ kind: 'ordinary-pass', status: 0 }), false);
  // Synthetic receipt classification only. No execute/apply/prepare port is
  // invoked, and this is NOT caught proof for any project definition.
  const receipt = classifyCommandResult({ status: 1, stdout: 'AssertionError: rejected invalid input' });
  assert.equal(isProofOutcome(receipt), true);
  assert.equal(receipt.kind, 'assertion-killed');
});

test('#910 AC2 evidence checklist keeps explicit distinctions and resolvable local links, not semantic approval', () => {
  const anchor = 'evidence-accuracy-and-historical-errata-910';
  const section = sectionText(read('docs/DEVELOPMENT.md'), anchor);
  assert.ok(section, 'the bounded evidence checklist has an addressed section');
  assert.ok(markdownLinks(read('docs/TESTING.md')).some(link => link.file === 'DEVELOPMENT.md' && link.anchor === anchor),
    'TESTING links to the checklist without expanding its fixed line budget');
  for (const phrase of ['`executed`', '`reused`', '`equivalence`', '`not run / unknown`',
    'фактически исполненные SHA/tree', 'будущий SHA не называть измеренным',
    'совпадение содержимого — не новое измерение', 'поздний PASS не объясняет старый неизвестный FAIL',
    'конечного списка исполненных случаев/счётчиков', 'Golden threshold PASS', 'nonzero differingPixels',
    'byte-identical witness floor', 'до краткого display сохранить raw stdout/stderr',
    'material и истинный exit', 'Усечённый tool display не объявлять полным raw',
    'original verdict, машинные anchors и raw не переписывать', 'не семантическую истинность отчётов'])
    assert.ok(norm(section).includes(norm(phrase)), 'checklist lost explicit text: ' + phrase);
  const links = markdownLinks(section);
  assert.equal(links.length, 1, 'one bounded dated errata, not an evidence platform');
  for (const link of links) {
    const target = normalize(join('docs', link.file));
    assert.ok(existsSync(join(ROOT, target)), 'missing checklist link: ' + target);
    if (link.anchor) assert.ok(headings(read(target)).some(heading => heading.anchor === link.anchor));
  }
});
