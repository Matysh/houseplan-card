import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, statSync } from 'node:fs';
import { HA_LOCK } from './ha-runtime.mjs';

export const LAB_ROOT = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(LAB_ROOT, '../..');
export const DEFAULT_CACHE = resolve(homedir(), '.cache', 'houseplan-ui-lab', HA_LOCK.version);

export function parseOptions(argv, { prepare = false } = {}) {
  const options = {};
  const names = prepare ? ['ha-cache', 'wheel'] : ['port', 'ha-cache', 'fixture', 'assets', 'theme', 'overrides'];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { options.help = true; continue; }
    const match = /^(--[^=]+)(?:=(.*))?$/.exec(argv[i]);
    const name = match?.[1]?.slice(2);
    if (!names.includes(name)) throw new Error(`Unknown UI Lab option: ${argv[i]}`);
    const value = match[2] ?? argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
    const key = name === 'ha-cache' ? 'haCache' : name;
    if (Object.hasOwn(options, key)) throw new Error(`Repeated option: --${name}`);
    options[key] = name === 'port' ? Number(value) : value;
  }
  return options;
}

export function resolveOptions(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? REPO_ROOT), labRoot = resolve(options.labRoot ?? LAB_ROOT);
  const port = options.port ?? 8891;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('UI Lab --port must be an integer from 0 to 65535');
  const result = { repoRoot, labRoot, port, haCache: resolve(options.haCache ?? DEFAULT_CACHE),
    fixture: resolve(options.fixture ?? resolve(labRoot, 'fixture.json')), privateDataset: !!options.fixture };
  for (const [name, type] of [['fixture', 'file'], ['assets', 'directory'], ['theme', 'file'], ['overrides', 'directory']]) {
    const value = name === 'fixture' ? result.fixture : options[name] && resolve(options[name]);
    if (!value) continue;
    if (!existsSync(value) || !(type === 'file' ? statSync(value).isFile() : statSync(value).isDirectory())) {
      throw new Error(`UI Lab --${name} must name an existing ${type}`);
    }
    result[name] = value;
  }
  return result;
}
