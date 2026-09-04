import {
  captureEnvironment, foreignCaptureAllowance, foreignCaptureRefusal,
} from '../../scripts/capture-environment.mjs';

// The name must NOT end with `manifest.json`: the HACS submission check globs
// `*manifest.json` over the whole clone of the default branch and refuses a
// repository with more than one match (test/repo-hygiene.test.mjs).
export const GOLDEN_BASELINE_MANIFEST = 'baselines-index.json';

/**
 * Проверка вызова — и заодно проверка среды съёмки (#455).
 *
 * Почему здесь, а не в `run.mjs`: `run.mjs` входит в корпус
 * `sourceFingerprint`, и его правка объявляет устаревшими закоммиченный бандл,
 * манифест скриншотов документации и индекс эталонов. Этот файл из корпуса
 * исключён именно как «предикаты, вызываемые до и после съёмки», и уже
 * вызывается первой строкой `run.mjs` — гейт встаёт без единой правки
 * фингерпринтуемого файла.
 *
 * Платформа — ПАРАМЕТР, а не `process.platform` внутри: иначе юнит стал бы
 * зелёным на Linux и красным на машине владельца, то есть тестом про хост, а
 * не про правило.
 */
export const assertGoldenInvocation = (mode, scenarioFilter = '', options = {}) => {
  if (!['capture', 'verify'].includes(mode)) throw new Error(`unknown golden mode: ${mode}`);
  if (mode === 'verify' && scenarioFilter)
    throw new Error('golden verify must run the complete matrix; use capture for a diagnostic --scenario run');
  // Диагностический прогон verify в чужой среде законен: он ничего не принимает.
  if (mode !== 'capture') return;
  const platform = options.platform ?? captureEnvironment().platform;
  const allowance = options.allowance ?? foreignCaptureAllowance();
  const { refusal, allowance: accepted } = foreignCaptureRefusal({
    platform, kind: 'golden', stage: 'capture', allowance,
  });
  if (refusal) throw new Error(refusal);
  if (accepted) console.log(`Чужая среда съёмки разрешена осознанно: ${accepted}`);
};

/** A reviewed golden matrix is exact: neither an orphan PNG nor a stale hash
 * entry may survive after a scenario is removed or renamed. */
export const goldenScenarioSetsMatch = (expected, indexed, baselineFiles) => {
  const normalized = (values) => [...new Set(values)].sort();
  const wanted = normalized(expected);
  return JSON.stringify(normalized(indexed)) === JSON.stringify(wanted)
    && JSON.stringify(normalized(baselineFiles)) === JSON.stringify(wanted);
};

export const goldenRunFailed = (mode, manifestValid, results) => {
  if (results.some((result) => result.status === 'error')) return true;
  return mode === 'verify'
    && (!manifestValid || results.some((result) => result.status !== 'passed'));
};
