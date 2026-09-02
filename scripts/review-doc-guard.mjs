#!/usr/bin/env node
/**
 * Публикация ревью-документа не имеет права трогать ничего, кроме него (#365).
 *
 *   git diff --name-only "origin/dev...HEAD" | node scripts/review-doc-guard.mjs
 *   node scripts/review-doc-guard.mjs --allow 'docs/specs/' < paths.txt
 *
 * Что случилось. 28.08 шаг публикации запушил в `dev` коммит `bb2919f` с
 * тридцатью файлами вместо одного markdown: откатил отревьюженную реализацию
 * #359, вернул старые чанки и оставил в `dist/` двойной набор. `dev` держал
 * откаченное дерево три часа, пока владелец не восстановил его руками
 * (`fd762fa`). Сообщение коммита при этом было невинным — «docs: review document
 * for #359», — и от рутины инцидент отличался только диффом.
 *
 * Почему это класс, а не случай. Пушащий шаг ничем не ограничен по путям, а его
 * рабочая копия может разойтись с origin по десятку причин: гонка параллельных
 * агентов за `dev` (в тот вечер их было три), ревью длиной в сорок минут,
 * ветка задачи, которой нет. Любой такой рассинхрон превращает «положить один
 * markdown» в «затереть dev целиком», и заметить это может только аудит дельты.
 * Релиз собирается из `dev` — рецидив уехал бы пользователям.
 *
 * Поэтому проверка судит не намерение шага, а его результат: набор путей,
 * который пуш добавит в целевую ветку. Пустой список — тоже отказ: публиковать
 * нечего, значит что-то пошло не так раньше.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const REVIEW_DOC_ALLOWLIST = ['docs/reviews/'];

/**
 * Пути вне разрешённых каталогов.
 *
 * Сравнение по префиксу каталога, а не по расширению: `docs/reviews/x.md`
 * разрешён, `docs/reviews-old/x.md` — нет, потому что префикс каталога
 * заканчивается слэшем и подстрокой не притворяется.
 */
export function pathsOutsideAllowlist(paths, allowlist = REVIEW_DOC_ALLOWLIST) {
  const prefixes = allowlist.map((item) => (item.endsWith('/') ? item : `${item}/`));
  return [...new Set((paths || [])
    .map((line) => String(line).trim())
    .filter(Boolean))]
    .filter((path) => !prefixes.some((prefix) => path.startsWith(prefix)))
    .sort();
}

/** Вердикт по набору путей: `null` — можно публиковать. */
export function reviewDocPushRefusal(paths, allowlist = REVIEW_DOC_ALLOWLIST) {
  const cleaned = [...new Set((paths || []).map((line) => String(line).trim()).filter(Boolean))];
  if (!cleaned.length) {
    return 'публиковать нечего: дифф пуст, а шаг вызван — значит документ не создан'
      + ' либо база уже содержит его';
  }
  const outside = pathsOutsideAllowlist(cleaned, allowlist);
  if (!outside.length) return null;
  return `публикация ревью-документа задевает ${outside.length} путь(ей) вне`
    + ` ${allowlist.join(', ')}:\n  ${outside.join('\n  ')}\n`
    + 'Пуш отменён. Так 28.08 коммит bb2919f откатил dev на три часа:'
    + ' рабочая копия шага разошлась с origin, и «положить один markdown»'
    + ' превратилось в «затереть dev целиком» (#365).';
}

/**
 * Сколько первых строк документа считаются шапкой. Материал раунда объявляется
 * там — измерено по корпусу: из 555 опубликованных ревью 409 называют SHA в
 * первых пятнадцати строках. Дальше начинается проза, и в ней SHA упоминаются
 * исторически («коммит bb2919f откатил dev»), проверять их нечего.
 */
export const REVIEW_HEADER_LINES = 20;

/** Строки шапки, объявляющие материал раунда. */
const MATERIAL_MARKER = /(Материал|Коммит дельты|SHA|HEAD\s*=|коммит)/;

/**
 * Кандидаты в SHA. Границы подобраны по корпусу, а не по вкусу:
 *
 * - 7–40 знаков: короче не бывает сокращений git, длиннее не бывает sha1.
 *   Отсекает заодно sha256 (64) — их в отчётах много, и они не коммиты;
 * - хотя бы одна буква a–f: иначе в кандидаты попадают номера прогонов и даты
 *   вида `20260901`;
 * - не после `#`: цвет `#607d8bff` — восемь шестнадцатеричных знаков;
 * - не внутри более длинной шестнадцатеричной последовательности и не через
 *   дефис: `sha256-…` и обрезанные хвосты хешей кандидатами не считаются.
 */
const SHA_CANDIDATE = /(?<![0-9a-f#-])[0-9a-f]{7,40}(?![0-9a-f-])/g;

/**
 * SHA, объявленные материалом раунда: `[{ line, sha }]`.
 *
 * Зачем отдельная функция и почему только шапка. PROCESS.md §2.10 требует
 * называть SHA предыдущего раунда затем, чтобы дельта следующего объявлялась
 * воспроизводимой командой `git diff <sha>..HEAD`. Проверять имеет смысл ровно
 * то, что этой командой пользуются: объявление материала. Исторические
 * упоминания в прозе — не обещание воспроизводимости.
 */
export function citedMaterialShas(text, headerLines = REVIEW_HEADER_LINES) {
  const found = [];
  String(text ?? '').split('\n').slice(0, headerLines).forEach((line, index) => {
    if (!MATERIAL_MARKER.test(line)) return;
    for (const sha of line.match(SHA_CANDIDATE) || []) {
      if (!/[a-f]/.test(sha)) continue;
      found.push({ line: index + 1, sha });
    }
  });
  return found;
}

/**
 * Вердикт: `null` — все объявленные SHA существуют коммитами.
 *
 * Зачем этот рубеж (#413). `SPEC-REVIEW-403-r2.md` объявил материал раунда на
 * `HEAD = 83005c3c`, и тот же SHA независимо назвал автор ТЗ в комментарии
 * issue. Коммита с таким именем в репозитории нет и не было: клон не мелкий,
 * `git rev-list --all` его не знает. Скорее всего значение снято до `amend`
 * или `rebase` при публикации — то есть проверка `git rev-parse HEAD` перед
 * выводом отчёта, которую требует §7.2, не выполнялась ни у автора, ни у
 * ревьюера.
 *
 * Цена уже заплачена на следующем раунде: пункт «найти SHA, на котором получен
 * предыдущий вердикт» выполнить буквально не удалось, реальный коммит
 * реконструировали по содержимому диффа.
 *
 * Чего этот рубеж НЕ умеет, и это важно знать. Он судит момент публикации.
 * Ветка задачи после ревью нередко перебазируется или сквошится, и SHA умирает
 * уже потом — по корпусу таких объявлений 98 из 804. Здесь ловится другой
 * класс: SHA, мёртвый уже в момент, когда его объявляют воспроизводимым.
 *
 * Достижимость проверяется от ссылок ПУБЛИКАЦИИ (`refs/remotes/origin/*` и
 * теги), а не от локальных. Разница не теоретическая: осиротевший `83005c3c`
 * до сих пор лежит объектом в клоне Codex и достижим там из локальной
 * `refs/heads/issue/403-area-relocation-safety`, не обновлённой после ребейза.
 * Читателю отчёта от этого нет никакой пользы — он может достать только то,
 * что есть на origin. Локальная проверка дала бы «всё в порядке» ровно на той
 * машине, где ошибку и совершили.
 *
 * @param resolveReachable функция `(shas) => Map<sha, ref|null>`
 */
export function danglingMaterialRefusal(text, resolveReachable, headerLines = REVIEW_HEADER_LINES) {
  const cited = citedMaterialShas(text, headerLines);
  if (!cited.length) return null;
  const refs = resolveReachable([...new Set(cited.map((item) => item.sha))]);
  const bad = cited.filter((item) => !refs.get(item.sha));
  if (!bad.length) return null;
  const lines = bad
    .map((item) => `  строка ${item.line}: ${item.sha} → не достижим ни из одной ссылки origin`)
    .join('\n');
  return 'ревью-документ объявляет материал раунда на SHA, которого нет на'
    + ` origin:\n${lines}\n`
    + 'Команда `git diff <sha>..HEAD` из PROCESS.md §2.10 на таком отчёте не'
    + ' работает, а следующий раунд восстанавливает коммит по содержимому'
    + ' диффа руками (#413). Сверьте SHA командой `git rev-parse HEAD`'
    + ' непосредственно перед выводом отчёта — §7.2 требует именно этого,'
    + ' а не значения, записанного до amend или rebase.';
}

const invokedDirectly = process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  // Режим проверки объявленного материала (#413): на входе сам документ.
  const docArg = argv.find((item) => item.startsWith('--doc='));
  if (docArg) {
    const path = docArg.slice('--doc='.length);
    let text;
    try {
      text = readFileSync(path === '-' ? 0 : path, 'utf8');
    } catch (error) {
      console.error(`::error::ревью-документ не прочитан: ${path} (${error.code || error.message})`);
      process.exit(1);
    }
    const resolveReachable = (shas) => {
      const map = new Map(shas.map((sha) => [sha, null]));
      for (const sha of shas) {
        const probe = spawnSync('git', [
          'for-each-ref', '--contains', sha, '--count=1',
          '--format=%(refname)', 'refs/remotes/origin', 'refs/tags',
        ], { encoding: 'utf8' });
        const ref = (probe.stdout || '').trim().split('\n')[0];
        if (probe.status === 0 && ref) map.set(sha, ref);
      }
      return map;
    };
    const refusal = danglingMaterialRefusal(text, resolveReachable);
    if (refusal) {
      console.error(`::error::${refusal.split('\n')[0]}`);
      console.error(refusal);
      process.exit(1);
    }
    const cited = citedMaterialShas(text);
    console.log(cited.length
      ? `материал раунда объявлен и достижим с origin: ${cited.map((item) => item.sha).join(', ')}`
      : 'материал раунда в шапке не объявлен — проверять нечего');
    process.exit(0);
  }
  const allowArg = argv.find((item) => item.startsWith('--allow='));
  const allowlist = allowArg
    ? allowArg.slice('--allow='.length).split(',').map((item) => item.trim()).filter(Boolean)
    : REVIEW_DOC_ALLOWLIST;
  const paths = readFileSync(0, 'utf8').split('\n');
  const refusal = reviewDocPushRefusal(paths, allowlist);
  if (refusal) {
    console.error(`::error::${refusal.split('\n')[0]}`);
    console.error(refusal);
    process.exit(1);
  }
  const count = paths.map((line) => line.trim()).filter(Boolean).length;
  console.log(`дифф публикации чист: ${count} файл(ов), все в ${allowlist.join(', ')}`);
}
