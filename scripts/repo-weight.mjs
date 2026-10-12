#!/usr/bin/env node
// #860/#628 read-only checkpoint. No GC, clone, LFS, quota or history mutation.
import { spawnSync } from 'node:child_process';
import { hostname, platform } from 'node:os';
import { isMainModule } from './spawn-portable.mjs';

export function weightReport({ git = args => {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('repo-weight: git measurement failed');
  return r.stdout;
}, now = new Date().toISOString(), host = hostname(), os = platform() } = {}) {
  const material = git(['rev-parse', 'HEAD']).trim();
  if (!/^[a-f0-9]{40}$/.test(material)) throw new Error('repo-weight: material missing');
  const counts = Object.fromEntries(git(['count-objects', '-v']).trim().split('\n').map(line => {
    const [key, value] = line.split(': '); return [key, Number(value)];
  }));
  if (!['size', 'size-pack', 'count', 'packs'].every(k => Number.isFinite(counts[k]) && counts[k] >= 0))
    throw new Error('repo-weight: incomplete object measurement');
  const groups = { png: { count: 0, bytes: 0 }, bundle: { count: 0, bytes: 0 }, other: { count: 0, bytes: 0 } };
  for (const line of git(['ls-tree', '-r', '-l', material]).trim().split('\n')) {
    const m = /^\d+ blob [a-f0-9]+\s+(\d+)\t(.+)$/.exec(line);
    if (!m) continue;
    const group = /\.png$/i.test(m[2]) ? groups.png
      : /^(dist\/|custom_components\/houseplan\/frontend\/)/.test(m[2]) ? groups.bundle : groups.other;
    group.count++; group.bytes += Number(m[1]);
  }
  return { schema: 1, material, measuredAt: now, host, platform: os, phase: 'without-gc', counts,
    objectStoreKiB: counts.size + counts['size-pack'], trackedBlobs: groups,
    checkpoint: { date: '2026-10-25', windowsPostGcMiB: 467.63, upperBoundMiB: 487.63,
      comparable: false, reason: 'Compare only the same Windows clone after the owner-authorized checkpoint GC; raw host/phase totals are not that acceptance metric.' } };
}
if (isMainModule(import.meta.url)) {
  try { console.log(JSON.stringify(weightReport(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
