// Переносимый запуск команд (#496).
//
// Две Windows-ловушки, из-за которых тесты инфраструктуры падали на машине
// владельца при зелёном Linux CI:
//
// 1. `new URL(\`file://${process.argv[1]}\`)` для `C:\...\x.mjs` даёт
//    `file:///C:/C:/...` — сравнение с `import.meta.url` ложно, CLI молчит.
//    Правильно — `pathToFileURL`, он знает про буквы дисков.
// 2. `spawn(cmd, args, { shell: true })` склеивает аргументы в строку без
//    экранирования: `node -e "…"` с кавычками и пробелами разваливается. Оболочка
//    нужна ТОЛЬКО для `.cmd`/`.bat` (Node ≥ 18.20 иначе бросает EINVAL), то есть
//    для `npm` на Windows; `node` и `git` запускаются напрямую.
//
// #733: `process.argv[1]` — путь, КАК его набрали (симлинк остаётся симлинком),
// а `import.meta.url` главного модуля Node строит по реальному пути. Запуск
// через симлинк (или из каталога-симлинка) давал `false`, и CLI молча выходил
// с кодом 0. Поэтому сравниваются реальные пути обеих сторон.

import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Реальный путь; для несуществующего — сам путь, как было до #733. */
function realOrSame(path) {
  try { return realpathSync(path); } catch { return path; }
}

/** Скрипт запущен как CLI, а не импортирован (переносимая форма). */
export function isMainModule(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    return pathToFileURL(realOrSame(argv1)).href === pathToFileURL(realOrSame(fileURLToPath(metaUrl))).href;
  } catch { return false; }
}

/** Что и как запускать: `{ cmd, shell }` для `spawn`/`spawnSync`. */
export function portableCommand(cmd, platform = process.platform) {
  if (platform !== 'win32') return { cmd, shell: false };
  if (cmd === 'npm' || cmd === 'npx') return { cmd: `${cmd}.cmd`, shell: true };
  if (/\.(cmd|bat)$/i.test(cmd)) return { cmd, shell: true };
  return { cmd, shell: false };
}
