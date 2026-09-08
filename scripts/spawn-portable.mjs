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

import { pathToFileURL } from 'node:url';

/** Скрипт запущен как CLI, а не импортирован (переносимая форма). */
export function isMainModule(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try { return pathToFileURL(argv1).href === metaUrl; } catch { return false; }
}

/** Что и как запускать: `{ cmd, shell }` для `spawn`/`spawnSync`. */
export function portableCommand(cmd, platform = process.platform) {
  if (platform !== 'win32') return { cmd, shell: false };
  if (cmd === 'npm' || cmd === 'npx') return { cmd: `${cmd}.cmd`, shell: true };
  if (/\.(cmd|bat)$/i.test(cmd)) return { cmd, shell: true };
  return { cmd, shell: false };
}
