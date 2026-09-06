// Режим проверки свежести скриншотов документации (#479).
//
// Отпечаток скриншотов считается по всему `src/**`, поэтому любая правка
// фронтенда делает его устаревшим, а содержательно кадры меняются раз в
// несколько бет. Две проверки свежести — отпечаток и capture-скрипт — в режиме
// `warn` предупреждают, не роняя код выхода; всё остальное у `check-docs`
// (гайды, ссылки, хеши картинок, полнота набора сцен) красит в обоих режимах.
// Умолчание — `strict`: старый вызов без флага не ослабевает молча. `warn`
// включают preflight на обычном пуше; кандидат беты и релизный гейт — `strict`.

export const SCREENSHOT_MODES = ['warn', 'strict'];

export function screenshotsMode(argv) {
  const flag = (argv || []).find((arg) => arg.startsWith('--screenshots='));
  if (!flag) return 'strict';
  const mode = flag.slice('--screenshots='.length);
  if (!SCREENSHOT_MODES.includes(mode)) {
    throw new Error(`--screenshots expects ${SCREENSHOT_MODES.join('|')}, got "${mode}"`);
  }
  return mode;
}

/** Куда класть находку свежести: в предупреждения (`warn`) или в ошибки. */
export function freshnessSink(mode, { errors, warnings }) {
  if (mode === 'warn') return warnings;
  if (mode === 'strict') return errors;
  throw new Error(`unknown screenshots mode "${mode}"`);
}
