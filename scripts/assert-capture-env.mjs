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
 *   node scripts/assert-capture-env.mjs <golden|docs> [--stage=capture|accept]
 */
import { assertCaptureEnvironment } from './capture-environment.mjs';

const [kindArg] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const stageArg = process.argv.find((arg) => arg.startsWith('--stage='));
const kind = kindArg === 'docs' ? 'docs' : 'golden';
const stage = stageArg?.slice('--stage='.length) === 'accept' ? 'accept' : 'capture';

try {
  const allowance = assertCaptureEnvironment({ kind, stage });
  if (allowance) console.log(`Чужая среда разрешена осознанно: ${allowance}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
