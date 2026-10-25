#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { compareDaycycleReports } from '../demo/helpers/daycycle-analysis.mjs';

export function compareDaycycleFiles(left, right) {
  if (!left || !right) throw new Error('usage: node scripts/daycycle-compare.mjs LEFT.json RIGHT.json');
  return compareDaycycleReports(JSON.parse(readFileSync(left, 'utf8')), JSON.parse(readFileSync(right, 'utf8')));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(compareDaycycleFiles(...process.argv.slice(2)), null, 2));
}
