// Fingerprints and the reusable caught-witness ledger.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MUTATION_PROOF } from './mutation-guard-outcome.mjs';
import { anchorRegion, guardInputs } from './mutation-selection.mjs';
import { withoutProductVersion } from './source-fingerprint.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * Отпечаток свидетеля (#481): содержимое файлов патча и гарда плюс само
 * объявление мутанта. Строка версии продукта нормализуется, как в
 * `visualFingerprint` (#245): релизный бамп трогает `houseplan-card.ts` и
 * `houseplan-editor-runtime.ts`, по которым отбираются десятки мутантов, но
 * ни одного свидетеля не меняет. Приближение то же, что у отбора по диффу:
 * непрямые зависимости гарда не учитываются — полный прогон остаётся
 * контрактом, журнал его не заменяет.
 */
export function witnessFingerprint(mutant, {
  root = repoRoot,
  read = (file) => (existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : ''),
  exists = (file) => existsSync(join(root, file)),
  normalize = withoutProductVersion(root),
  inputsOf = (guard) => guardInputs(guard, { exists, read }),
} = {}) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({
    id: mutant.id,
    guard: mutant.guard,
    oracle: mutant.oracle || MUTATION_PROOF.ASSERTION,
    patches: mutant.patches,
  }));
  hash.update('\0');
  const text = (file) => String(read(file)).replace(/\r\n?/g, '\n');
  // Сторона патча — только область якоря (#518); сторона гарда — файл целиком:
  // у гарда якоря нет, он судит поведение и меняется весь.
  const entries = [
    ...mutant.patches.map((patch, index) => [
      `${patch.file}#якорь-${index}`,
      () => anchorRegion(text(patch.file), patch.find),
    ]),
    ...inputsOf(mutant.guard).map((file) => [file, () => text(file)]),
  ].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [key, valueOf] of entries) {
    hash.update(key);
    hash.update('\0');
    hash.update(normalize(valueOf()));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export const LEDGER_SCHEMA = 2;

const emptyLedger = () => ({ schema: LEDGER_SCHEMA, caught: {} });
const validProof = (proof) => Object.values(MUTATION_PROOF).includes(proof);

/**
 * Журнал доказанных свидетелей.
 *
 * Schema 2 намеренно не принимает старые строки fingerprint: до #550 они не
 * доказывали, что упал именно oracle, а не tsc/setup перед ним.
 */
export function readLedger(file) {
  if (!file || !existsSync(file)) return emptyLedger();
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (parsed?.schema !== LEDGER_SCHEMA || typeof parsed.caught !== 'object' || !parsed.caught) {
      return emptyLedger();
    }
    const caught = {};
    for (const [id, value] of Object.entries(parsed.caught)) {
      if (typeof value?.fingerprint === 'string' && validProof(value.proof)) caught[id] = { ...value };
    }
    return { schema: LEDGER_SCHEMA, caught };
  } catch {
    // Битый журнал — не отказ гейта: он лишь сужает работу, и пустой журнал
    // означает «гонять всё отобранное», то есть прежнее поведение.
    return emptyLedger();
  }
}

/**
 * Записать пойманного свидетеля — сразу, а не в конце прогона: отменённый
 * или упавший по таймауту шард обязан сохранить уже сделанное, иначе
 * следующий пуш начинает с нуля (снежный ком #481).
 */
export function recordCaught(file, ledger, mutant, fingerprint, proof = MUTATION_PROOF.ASSERTION) {
  if (!validProof(proof)) throw new Error(`нельзя записать недоказанный outcome в ledger: ${proof}`);
  ledger.caught[mutant.id] = { fingerprint, proof };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ schema: LEDGER_SCHEMA, caught: ledger.caught }, null, 2)}\n`);
}

/**
 * Мутанты, чей отпечаток совпадает с журналом, уже доказали, что ловятся на
 * этих же входах — их пропуск ничего не ослабляет. Сравнивается ОТПЕЧАТОК,
 * не факт присутствия id: запись от другого содержимого файлов не считается.
 */
export function splitByLedger(mutants, ledger, fingerprintOf = (m) => witnessFingerprint(m)) {
  const run = [];
  const skipped = [];
  for (const mutant of mutants) {
    const fingerprint = fingerprintOf(mutant);
    const proof = ledger.caught[mutant.id];
    const expectedProof = mutant.oracle || MUTATION_PROOF.ASSERTION;
    if (proof?.fingerprint === fingerprint && proof.proof === expectedProof
      && validProof(proof.proof)) skipped.push(mutant);
    else run.push({ mutant, fingerprint });
  }
  return { run, skipped };
}
