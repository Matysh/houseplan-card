#!/usr/bin/env node
/**
 * Проходной вызов `demo/golden/accept.mjs` (#334, #350, #351).
 *
 *   node scripts/golden-accept.mjs --reviewed --expect-change=<id,id>
 *   node scripts/golden-accept.mjs --reviewed --expect-new=<id,id>
 *   node scripts/golden-accept.mjs --reviewed --expect-change=… --no-witnesses --reason="…"
 *
 * Floor свидетелей (#355): после вычета объявленных сцен должно остаться
 * достаточно необъявленных, совпавших с эталоном байт-в-байт, — они доказывают,
 * что среда съёмки та же, что у принятого эталона. Тотальная перерисовка
 * обходится только явным `--no-witnesses --reason="…"`; причина уезжает в
 * манифест эталонов.
 *
 * Обёртка появилась потому, что до #344 любой `.mjs` из `demo/golden` входил в
 * корпус отпечатка, и правка инструмента приёмки объявляла устаревшими бандл и
 * оба манифеста. После #344 это ограничение снято, правило живёт в самом
 * `accept.mjs`, а этот файл остался ради документированной команды и передаёт
 * аргументы как есть.
 *
 * Два флага утверждают разное: `--expect-change` — «я знаю, почему старый кадр
 * изменился», `--expect-new` — «я посмотрел на новый кадр». Необъявленная сцена
 * не переписывается вовсе: её эталон и хеш остаются прежними (#351).
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
if (!argv.includes('--reviewed')) {
  console.error('приёмка требует явного --reviewed');
  process.exit(2);
}
const accept = spawnSync(process.execPath, [
  resolve(ROOT, 'demo/golden/accept.mjs'), ...argv,
], { cwd: ROOT, stdio: 'inherit' });
process.exit(accept.status ?? 1);
