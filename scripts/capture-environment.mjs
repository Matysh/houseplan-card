/**
 * Среда съёмки как проверяемое условие, а не как знание в голове (#455).
 *
 * Правило после #401: принимается любая среда, доказавшая себя байтовым
 * совпадением непринятых кадров. Windows такого совпадения не даёт и не может:
 * другая растеризация шрифтов (DirectWrite против FreeType), субпиксельное
 * сглаживание, DPI и другая сборка Chromium. Флаги детерминизма из #410
 * (`--force-color-profile=srgb`, `--font-render-hinting=none`,
 * `--disable-lcd-text`, целочисленный клип) убирают разброс ВНУТРИ среды, а не
 * между операционными системами.
 *
 * До этой задачи знание «на Windows снимать бесполезно» жило только в головах и
 * в документах ревью. Съёмка отрабатывала штатно, а стена появлялась на
 * приёмке — и текст той стены говорил про число сцен-свидетелей, то есть
 * подсказывал неверный вывод «надо объявить больше сцен». Отсюда две вещи:
 * отказ переносится на самое начало, а текст называет причину.
 *
 * Проверка съёмки — не то же, что проверка приёмки: `golden:verify` на Windows
 * законен и полезен как грубая проверка «не сломал ли рендер вообще». Запрещена
 * только съёмка с расчётом на приёмку.
 *
 * Где гейт НЕ стоит и почему. В `demo/docs/capture.mjs` — ни строки: его sha
 * записан в манифест скриншотов документации (`captureScriptSha256`), и
 * `scripts/check-docs.mjs` сверяет его с файлом. Любая правка объявляет
 * закоммиченный индекс устаревшим, то есть стоит пересъёмки десяти картинок и
 * визуальной приёмки владельца — за проверку, которая ничего не рисует.
 * Проверено на себе: первая редакция этой задачи правку сделала, и гейт
 * документации сразу покраснел. Поэтому для документации отказ живёт на шаг
 * раньше (`scripts/assert-capture-env.mjs` в npm-скрипте `docs:capture`) и на
 * шаг позже (приёмка). То же и для golden: гейт в `policy.mjs`, а не в
 * `run.mjs`, который входит в корпус `sourceFingerprint`.
 */

/** Канон среды съёмки: Linux CI и WSL. */
export const CAPTURE_CANON_PLATFORM = 'linux';

/** Переменная осознанного обхода. Пустая причина обходом не считается. */
export const ALLOW_FOREIGN_ENV = 'HP_ALLOW_FOREIGN_CAPTURE';

const WSL_COMMAND = {
  golden: 'wsl -d Ubuntu → cd ~/houseplan-card && npm run build && npm run golden:capture',
  docs: 'wsl -d Ubuntu → cd ~/houseplan-card && npm run build && node demo/docs/capture.mjs',
};

/** Провенанс среды: то, что уезжает в манифест рядом с версией Chromium. */
export const captureEnvironment = (source = process) => ({
  platform: String(source.platform || ''),
  arch: String(source.arch || ''),
});

/**
 * Разрешён ли осознанный обход. Возвращает причину или `null`.
 * Пустая строка — не причина: обход без записанной причины неотличим от
 * забытой переменной в окружении.
 */
export const foreignCaptureAllowance = (env = process.env) => {
  const reason = String(env?.[ALLOW_FOREIGN_ENV] ?? '').trim();
  return reason || null;
};

/**
 * Отказ съёмки или приёмки в чужой среде.
 *
 * `kind`: `golden` | `docs` — от него зависит только команда в подсказке.
 * `stage`: `capture` | `accept` — от него зависит формулировка.
 * Возвращает `{ refusal, allowance }`: `refusal` — текст или `null`.
 */
export const foreignCaptureRefusal = ({
  platform,
  kind = 'golden',
  stage = 'capture',
  canon = CAPTURE_CANON_PLATFORM,
  allowance = null,
} = {}) => {
  if (platform === canon) return { refusal: null, allowance: null };
  if (allowance) return { refusal: null, allowance };
  const what = kind === 'docs' ? 'скриншоты документации' : 'эталоны golden';
  const action = stage === 'accept'
    ? `приёмка отказана: ${what} сняты на платформе «${platform}»`
    : `съёмка отказана: ${what} на платформе «${platform}» принять будет нечем`;
  return {
    refusal: `${action}. Байтового совпадения с принятыми кадрами Windows не даёт`
      + ' (растеризация шрифтов, субпиксельное сглаживание, DPI, другая сборка Chromium),'
      + ` поэтому сцен-свидетелей среды будет ноль и приёмка откажет. Снимайте в WSL:\n`
      + `  ${WSL_COMMAND[kind] || WSL_COMMAND.golden}\n`
      + `Диагностика на Windows законна: golden:verify показывает расхождения и ничего не принимает.`
      + ` Если чужая среда осознанна — ${ALLOW_FOREIGN_ENV}="причина" оставит её в выводе и в манифесте.`,
    allowance: null,
  };
};

/**
 * Приписка к отказу приёмки, когда среда кадров и эталонов разошлась.
 *
 * Именно этой фразы не хватало: без неё отказ «свидетелей 0 из 10» читается
 * как «объяви больше сцен», и обход в одну команду выглядит решением.
 */
export const environmentNote = ({ capturedOn, acceptedOn } = {}) => {
  if (!capturedOn || !acceptedOn || capturedOn === acceptedOn) return null;
  return `среда съёмки (${capturedOn}) не совпадает со средой принятых эталонов`
    + ` (${acceptedOn}): свидетелей и не могло быть — дело не в числе объявленных сцен`;
};

/**
 * Бросающая обёртка для точек, где отказ обязан остановить работу.
 *
 * Возвращает разрешённую причину обхода (или `null`) — вызывающий печатает её
 * сам, чтобы след остался в выводе прогона.
 */
export const assertCaptureEnvironment = ({
  kind = 'golden', stage = 'capture', platform, allowance,
} = {}) => {
  const resolvedPlatform = platform ?? captureEnvironment().platform;
  const resolvedAllowance = allowance ?? foreignCaptureAllowance();
  const { refusal, allowance: accepted } = foreignCaptureRefusal({
    platform: resolvedPlatform, kind, stage, allowance: resolvedAllowance,
  });
  if (refusal) throw new Error(refusal);
  return accepted;
};
