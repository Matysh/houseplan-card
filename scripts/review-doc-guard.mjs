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

const invokedDirectly = process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  const argv = process.argv.slice(2);
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
