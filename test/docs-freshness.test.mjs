import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshnessSink, screenshotsMode } from '../scripts/docs-freshness.mjs';

// #479: свежесть скриншотов документации на обычном пуше — предупреждение, на
// кандидате беты — ошибка. Умолчание строгое, чтобы старый вызов не ослаб молча.

test('без флага режим строгий, warn и strict принимаются, мусор отвергается (#479)', () => {
  assert.equal(screenshotsMode([]), 'strict');
  assert.equal(screenshotsMode(['--external']), 'strict');
  assert.equal(screenshotsMode(['--screenshots=warn']), 'warn');
  assert.equal(screenshotsMode(['--screenshots=strict']), 'strict');
  assert.throws(() => screenshotsMode(['--screenshots=off']), /warn\|strict/);
});

test('warn складывает находки свежести в предупреждения, strict — в ошибки (#479)', () => {
  const errors = []; const warnings = [];
  freshnessSink('warn', { errors, warnings }).push('stale');
  freshnessSink('strict', { errors, warnings }).push('stale');
  assert.deepEqual(warnings, ['stale']);
  assert.deepEqual(errors, ['stale']);
  assert.throws(() => freshnessSink('maybe', { errors, warnings }));
});

test('check-docs: только две проверки свежести идут через режим, остальное — всегда ошибка (#479)', () => {
  const source = readFileSync(new URL('../scripts/check-docs.mjs', import.meta.url), 'utf8');
  const viaMode = [...source.matchAll(/freshness\.push\(([^)]*)\)/g)].map((m) => m[1]);
  assert.equal(viaMode.length, 2, 'ровно две проверки свежести: отпечаток и capture-скрипт');
  assert.ok(viaMode[0].includes('fingerprint is stale'));
  assert.ok(viaMode[1].includes('capture script changed'));
  // Хеш картинки, полнота набора сцен и ссылки не имеют права ослабляться.
  for (const always of ['image hash does not match manifest', 'scenario set is incomplete', 'external link returned']) {
    const line = source.split('\n').find((l) => l.includes(always));
    assert.ok(line && line.includes('errors.push'), `${always} остаётся ошибкой в обоих режимах`);
  }
});
