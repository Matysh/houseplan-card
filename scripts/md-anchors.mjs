// #634: якоря заголовков Markdown так, как их строит GitHub, и ссылки из текста.
//
// Ролевые конспекты процесса и индекс приложений TESTING.md ссылаются на
// разделы по якорю; тесты проверяют, что якорь существует. Правило GitHub:
// нижний регистр, выбросить всё, кроме букв, цифр, `_`, пробела и дефиса,
// каждый пробел — дефис (без схлопывания: «2.6 В разработке — реализация» →
// `26-в-разработке--реализация`), повтор — суффикс `-1`, `-2`.
// `scripts/check-docs.mjs` схлопывает дефисы для публичных документов — там
// это исторический контракт, здесь нужен настоящий якорь GitHub.

export const githubSlug = (heading) => heading
  .trim()
  .toLowerCase()
  .replace(/<[^>]+>/g, '')
  .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
  .replace(/ /g, '-');

/** Заголовки документа вне fenced-блоков: [{ level, text, anchor, line }]. */
export function headings(text) {
  const seen = new Map();
  const out = [];
  let fenced = false;
  text.replace(/\r\n?/g, '\n').split('\n').forEach((line, index) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) return;
    const base = githubSlug(match[2]);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    out.push({ level: match[1].length, text: match[2], anchor: count ? `${base}-${count}` : base, line: index });
  });
  return out;
}

/** Текст раздела по якорю: от заголовка до следующего того же или старшего уровня. */
export function sectionText(text, anchor) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const all = headings(text);
  const at = all.findIndex((heading) => heading.anchor === anchor);
  if (at < 0) return null;
  const next = all.slice(at + 1).find((heading) => heading.level <= all[at].level);
  return lines.slice(all[at].line, next ? next.line : lines.length).join('\n');
}

/** Относительные ссылки `[текст](путь#якорь)`; внешние URL пропускаются. */
export function markdownLinks(text) {
  return [...text.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)]
    .map((match) => match[2])
    .filter((target) => !/^[a-z]+:/i.test(target))
    .map((target) => {
      const hash = target.indexOf('#');
      return {
        target,
        file: hash >= 0 ? target.slice(0, hash) : target,
        anchor: hash >= 0 ? decodeURIComponent(target.slice(hash + 1)) : '',
      };
    });
}
