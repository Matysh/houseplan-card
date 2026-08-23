#!/usr/bin/env node
/**
 * Разложить собранный бандл по местам, которым он нужен (#255).
 *
 * Копий две с половиной. `custom_components/houseplan/frontend` — та, что
 * ставит HACS, она в репозитории и обязана совпадать с `dist` побайтово.
 * `demo/srv/assets` — рабочая копия стенда: её читают браузерные смоки, golden
 * и съёмка скриншотов, но в репозитории её больше нет. Раньше «скопировать
 * туда» жило шестью разными `cp` в воркфлоу и трижды в документации; когда
 * копию забывали, смок врал согласованно (#236).
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'dist/houseplan-card.js');
const TARGETS = [
  'custom_components/houseplan/frontend/houseplan-card.js',
  'demo/srv/assets/houseplan-card.js',
];

if (!existsSync(SOURCE)) {
  console.error('dist/houseplan-card.js не найден: сначала `npm run build`');
  process.exit(1);
}
for (const target of TARGETS) {
  const path = resolve(ROOT, target);
  mkdirSync(dirname(path), { recursive: true });
  copyFileSync(SOURCE, path);
  console.log(`бандл → ${target}`);
}
