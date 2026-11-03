#!/usr/bin/env node
/**
 * Build the Home Assistant config directory an E2E run boots from.
 *
 *   node scripts/prepare-seed.mjs [--out=run] [--variant=house|empty]
 *
 * `empty` keeps the same Home Assistant (areas, devices, users, dashboards)
 * but removes every House Plan document, so the run starts where a new user
 * does: the integration is configured, no plan exists yet.
 *
 * `seed/` is the pristine tree (derived from the public demo stand). It is
 * copied verbatim, then the parts that must never be committed are written:
 * the password hashes of the two test users and a fresh instance uuid.
 * Everything else — plan, areas, devices, dashboards, the House Plan config
 * entry — is the seed's own business.
 */
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USERS } from './users.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const out = resolve(ROOT, arg('out', 'run'));
const variant = arg('variant', process.env.E2E_SEED_VARIANT || 'house');

if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(resolve(ROOT, 'seed'), out, { recursive: true });

// Home Assistant stores bcrypt hashes base64-encoded (auth_provider.homeassistant).
const hash = (password) => Buffer.from(bcrypt.hashSync(password, 12)).toString('base64');
const provider = {
  version: 1,
  minor_version: 1,
  key: 'auth_provider.homeassistant',
  data: {
    users: Object.values(USERS).map((u) => ({ username: u.username, password: hash(u.password) })),
  },
};
mkdirSync(resolve(out, '.storage'), { recursive: true });
writeFileSync(resolve(out, '.storage/auth_provider.homeassistant'), JSON.stringify(provider, null, 2) + '\n');
writeFileSync(resolve(out, '.storage/core.uuid'), JSON.stringify({
  version: 1, minor_version: 1, key: 'core.uuid', data: { uuid: randomBytes(16).toString('hex') },
}, null, 2) + '\n');

if (variant === 'empty') {
  for (const file of ['houseplan.config', 'houseplan.layout', 'houseplan.trails']) {
    rmSync(resolve(out, '.storage', file), { force: true });
  }
  rmSync(resolve(out, 'houseplan'), { recursive: true, force: true });
} else if (variant !== 'house') {
  throw new Error(`unknown seed variant ${variant}`);
}
writeFileSync(resolve(out, '.e2e-seed.json'), JSON.stringify({ variant }, null, 2) + '\n');

console.log(`seed (${variant}) → ${out} (users: ${Object.values(USERS).map((u) => u.username).join(', ')})`);
