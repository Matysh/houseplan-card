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

/** Версия схемы отчёта съёмки, в которой провенанс обязателен (#571). */
export const CAPTURE_PROVENANCE_SCHEMA = 2;

/**
 * Провенанс СЪЁМКИ для отчёта (#571).
 *
 * До этой задачи отчёт платформу не нёс вовсе, и приёмщик записывал в индекс
 * эталонов СВОЮ платформу как платформу кадров. На `ad4000f9` это дало
 * `"platform": "win32"` у кадров, снятых Linux-прогоном 34853080375: индекс
 * утверждал неправду, а причина осознанного обхода осталась только в stdout.
 *
 * Поэтому провенанс собирается там, где кадры снимаются, и уезжает в отчёт:
 * платформа, архитектура, сборка Chromium, отпечаток материала и — если съёмка
 * шла в CI — прогон с попыткой. Последнее не косметика: артефакт можно скачать
 * и принять спустя сутки, и ссылка на прогон единственная, что связывает
 * картинки с их происхождением.
 */
export const captureProvenance = ({
  chromium = null, buildFingerprint = null, source = process, env = process.env,
} = {}) => {
  const { platform, arch } = captureEnvironment(source);
  const run = String(env?.GITHUB_RUN_ID ?? '').trim();
  const attempt = String(env?.GITHUB_RUN_ATTEMPT ?? '').trim();
  const repository = String(env?.GITHUB_REPOSITORY ?? '').trim();
  const sha = String(env?.GITHUB_SHA ?? '').trim();
  return {
    platform,
    arch,
    chromium: chromium || null,
    buildFingerprint: buildFingerprint || null,
    // Пустой объект вместо `null` был бы ложью «CI известен, полей нет».
    ci: run ? {
      repository: repository || null,
      run: Number(run) || null,
      attempt: Number(attempt) || 1,
      sha: sha || null,
    } : null,
  };
};

/**
 * Провенанс отчёта в пригодном для решения виде: `{ provenance, legacy }`.
 *
 * `legacy: true` — отчёт старой схемы, платформы съёмки в нём нет физически.
 * Такой отчёт не отвергается (артефакты живут дольше схемы), но и не выдаёт
 * себя за проверенный: платформа съёмки остаётся `null`, и вызывающий обязан
 * решить это явной веткой, а не молча подставить свою.
 */
export const reportCaptureProvenance = (report = {}) => {
  const schema = Number(report?.schema) || 1;
  const provenance = report?.capture;
  if (schema >= CAPTURE_PROVENANCE_SCHEMA) {
    // Fail-closed: схема обещает провенанс, значит его отсутствие — поломка
    // инструмента съёмки, а не повод угадывать.
    if (!provenance || typeof provenance !== 'object') {
      throw new Error(`отчёт схемы ${schema} обязан нести раздел capture с провенансом съёмки (#571)`);
    }
    if (!provenance.platform) {
      throw new Error(`отчёт схемы ${schema} не называет платформу съёмки (#571)`);
    }
    return { provenance, legacy: false };
  }
  return { provenance: null, legacy: true };
};

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
