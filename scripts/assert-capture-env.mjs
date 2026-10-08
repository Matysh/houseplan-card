#!/usr/bin/env node
/**
 * Отказ до съёмки — для тех точек, где гейт нельзя встроить в сам скрипт (#455).
 *
 * `demo/docs/capture.mjs` править нельзя дёшево: его sha записан в индексе
 * скриншотов документации, и `scripts/check-docs.mjs` сверяет их. Любая правка
 * объявляет закоммиченный индекс устаревшим — то есть стоит пересъёмки всех
 * картинок и визуальной приёмки владельца за проверку, которая ничего не
 * рисует. Поэтому проверка живёт шагом раньше, в npm-скрипте:
 *
 *   "docs:capture": "node scripts/assert-capture-env.mjs docs && npm run build && node demo/docs/capture.mjs"
 *
 * У golden такой проблемы нет: там гейт стоит в `demo/golden/policy.mjs`,
 * который исключён из корпуса отпечатка и уже вызывается из `run.mjs`.
 *
 * #827: на этапе съёмки здесь же судится фактически запущенный Chromium —
 * стандартный headless-запуск Playwright один раз против пинов toolchain
 * (`scripts/browser-attestation.mjs`). Каталог с пиновым именем и чужой сборкой
 * внутри (F33) отказывает до сборки и до первого кадра как непригодная среда;
 * разрешение чужой платформы этот отказ не обходит. Приёмка браузер не
 * запускает и его не судит: она проверяет уже снятые кадры.
 *
 *   node scripts/assert-capture-env.mjs <golden|docs> [--stage=capture|accept]
 */
import { assertCaptureEnvironment } from './capture-environment.mjs';
import { attestStandardLaunch } from './browser-attestation.mjs';

const [kindArg] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const stageArg = process.argv.find((arg) => arg.startsWith('--stage='));
const kind = kindArg === 'docs' ? 'docs' : 'golden';
const stage = stageArg?.slice('--stage='.length) === 'accept' ? 'accept' : 'capture';

try {
  const allowance = assertCaptureEnvironment({ kind, stage });
  if (allowance) console.log(`Чужая среда разрешена осознанно: ${allowance}`);
  if (stage === 'capture') await attestStandardLaunch({ reason: `${kind} capture` });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
