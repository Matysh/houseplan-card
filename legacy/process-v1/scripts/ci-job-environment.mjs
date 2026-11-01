// #954: stamp the producer runner, never the later proof-aggregation runner.
import { appendFileSync } from 'node:fs';
import { isMainModule } from './spawn-portable.mjs';

export const runnerEnvironment = (env = process.env) => ({ node: process.version, platform: process.platform, arch: process.arch,
  imageOS: env.ImageOS || null, imageVersion: env.ImageVersion || null });
export function matchingProducerEnvironment(stamp, expected, job) {
  const stamps = job === 'smoke' ? stamp : [stamp];
  if (!Array.isArray(stamps) || stamps.length !== (job === 'smoke' ? 3 : 1)) return false;
  const keys = ['node', 'platform', 'arch', 'imageOS', 'imageVersion'];
  return stamps.every(s => keys.every(k => typeof expected[k] === 'string' && expected[k] && s?.[k] === expected[k]));
}
export function producerEnvironments(needs) {
  const parse = text => { try { return JSON.parse(text); } catch { return null; } };
  return Object.fromEntries(['smoke', 'golden', 'performance_smoke', 'geometry_parity', 'backend'].map(job => [job,
    job === 'smoke' ? [1, 2, 3].map(n => parse(needs?.smoke?.outputs?.[`environment_${n}`]))
      : parse(needs?.[job]?.outputs?.environment)]));
}
if (isMainModule(import.meta.url)) {
  const key = process.argv.find(a => a.startsWith('--output='))?.slice(9) || 'environment';
  if (!/^environment(?:_[123])?$/.test(key)) throw Error('invalid producer environment output');
  const output = `${key}=${JSON.stringify(runnerEnvironment())}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
}
