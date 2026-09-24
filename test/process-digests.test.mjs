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
    ['1-основное-правило', 'Изменение продуктового кода без issue запрещено'],
    ['1-основное-правило', 'ни одного файла класса A'],
    ['1-основное-правило', 'D сильнее A'],
    ['3-правила', 'Ровно одна метка статуса'],
    ['3-правила', 'Статус меняется до действия, а не после'],
    ['5-лёгкий-трек-метка-small--путь-по-умолчанию', 'обосновывается не выбор лёгкого трека, а отказ от него'],
    ['51-короткий-трек-метка-trivial', 'ожидаемое поведение уже зафиксировано'],
    ['71-цепочка', 'Владельцу задаются только продуктовые вопросы'],
    ['71-цепочка', 'issue остаётся в `S3-spec` и получает `blocked`'],
    ['26-в-разработке--реализация', 'каждый коммит несёт трейлеры `Issue: #<NN>` и `User-Visible: yes|no`'],
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
    ['104-событийный-конвейер-метка-как-триггер', 'Один хендофф — один пуш'],
    ['104-событийный-конвейер-метка-как-триггер', 'Ветка приводится к `dev` до ревью, а не после'],
    ['104-событийный-конвейер-метка-как-триггер', 'Автор обязан дождаться вердикта, а не заканчивать сессию'],
    ['104-событийный-конвейер-метка-как-триггер', 'После прогона ревью метка меняется всегда'],
    ['72-шаблоны-комментариев', 'Вперёд двигает только зелёный вердикт'],
    ['12-запрещено', 'force-push в `dev`'],
    ['12-запрещено', 'попутные правки «раз уж я здесь»'],
  ],
  'docs/process/REVIEWER.md': [
    ['27-код-ревью', 'Ревьюер ≠ исполнитель'],
    ['24-тз-на-ревью', '`docs/reviews/SPEC-REVIEW-<NN>-r<N>.md`'],
    ['27-код-ревью', '`docs/reviews/CODE-REVIEW-<tag|NN>-r<N>.md`'],
    ['27-код-ревью', 'Ревьюер отвечает за полноту доказательств AC, а не заменяет их исполнение'],
    ['27-код-ревью', 'проверено чтением, не исполнением'],
    ['27-код-ревью', 'Защитный AC доказывается таблицей «чем краснеет»'],
    ['27-код-ревью', 'Пустой третий столбец — находка Medium, а не примечание'],
    ['27-код-ревью', '«Тест умеет падать» без названной мутации и её вывода доказательством не является'],
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
    ['71-цепочка', 'Технический спор автора и ревьюера решается вердиктом, а не владельцем'],
    ['12-запрещено', 'Medium-находки, оставленные как TODO в документе ревью'],
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
  const workflow = read('.github/workflows/process.yml');
  const start = workflow.indexOf('          prompt: |\n');
  const end = workflow.indexOf('          claude_args: |', start);
  assert.ok(start > 0 && end > start, 'блок prompt найден');
  const prompt = workflow.slice(start, end);
  const flat = prompt.replace(/\s+/g, ' ');
  assert.match(flat, /docs\/process\/REVIEWER\.md/, 'ревьюер читает конспект');
  for (const required of [
    '`Вердикт: зелёный/жёлтый/красный · заход r${{ needs.guard.outputs.cycle }} · блокирующих циклов ${{ needs.guard.outputs.spent }}/${{ needs.guard.outputs.limit }} · High: N · Medium: N → в задаче | #…`',
    'Материал ревью — ровно `${{ needs.prepare.outputs.material_sha }}`',
    'Не делай `git fetch`, `git pull` и `git checkout` на другой коммит',
    'переменной окружения REVIEW_DOC (абсолютный, ВНЕ репозитория)',
    'В самом репозитории не создавай файлов вообще',
    'SPEC-REVIEW для этапа spec, CODE-REVIEW для code',
    'Ты НЕ правишь ни ТЗ, ни продуктовый код',
    '«AC · чем доказан · чем краснеет»',
    'пустой третий столбец — находка Medium',
    '«Закрытие раунда r<N-1>»',
    '«Унаследовано из r<N-1>»',
    'какие гейты прогнал, какие нет и почему',
    'тип, приоритет, S1-new',
    '${{ needs.prepare.outputs.validated_note }}',
    '${{ needs.prepare.outputs.rebase_note }}',
    'Затем верни JSON по схеме',
  ]) assert.ok(flat.includes(required), `промпт потерял: ${required}`);
  // Правила живут в каноне; промпт, снова набравший пересказ, — возврат к 60–90 k
  // контекста до первого git diff (аудит 22.09). До #634 — 1 642 слова.
  const words = prompt.split(/\s+/).filter(Boolean).length;
  assert.ok(words <= 1400, `промпт ревьюера ${words} слов > 1400`);
});
