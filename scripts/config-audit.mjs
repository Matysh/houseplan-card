#!/usr/bin/env node
/**
 * Offline inventory of compatibility fields in exported House Plan JSON.
 * The command is read-only and performs no network requests.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_FIELD_REGISTRY } from './config-field-registry.mjs';

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const help = args.includes('--help') || args.includes('-h');
const paths = args.filter((arg) => !arg.startsWith('-'));
const unknownFlags = args.filter((arg) => arg.startsWith('-') && !['--json', '--help', '-h'].includes(arg));

const usage = () => {
  console.log('Usage: npm run audit:config -- [--json] <exported-config.json> [...]');
  console.log('Without a file, prints the registered compatibility decisions.');
};

const printable = (value) => {
  const text = JSON.stringify(value);
  return text && text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

const visit = (node, segments, displayPath, matches, selector, parent = null) => {
  if (!segments.length) {
    if (Object.hasOwn(selector, 'equals') && node !== selector.equals) return;
    if (selector.parent && (!parent || parent[selector.parent.key] !== selector.parent.equals)) return;
    matches.push({ path: displayPath || '$', value: node });
    return;
  }
  const [segment, ...rest] = segments;
  if (segment === '*') {
    if (!Array.isArray(node)) return;
    node.forEach((value, index) => visit(value, rest, `${displayPath}[${index}]`, matches, selector, value));
    return;
  }
  if (!node || typeof node !== 'object' || !Object.hasOwn(node, segment)) return;
  visit(node[segment], rest, `${displayPath}.${segment}`, matches, selector, node);
};

export const auditConfig = (input) => {
  const config = input?.config && typeof input.config === 'object' ? input.config : input;
  return CONFIG_FIELD_REGISTRY.map((field) => {
    const matches = [];
    visit(config, field.selector.path, '$', matches, field.selector);
    return { id: field.id, status: field.status, count: matches.length, matches };
  }).filter((row) => row.count > 0);
};

const printRegistry = () => {
  usage();
  console.log('');
  console.table(CONFIG_FIELD_REGISTRY.map(({ id, status, level, runtime }) => ({ id, status, level, runtime })));
};

const isMain = resolve(process.argv[1] || '') === fileURLToPath(import.meta.url);
if (isMain) {
  if (help) {
    usage();
  } else if (unknownFlags.length) {
    console.error(`config-audit: unknown option ${unknownFlags[0]}`);
    usage();
    process.exitCode = 2;
  } else if (!paths.length && jsonOutput) {
    console.error('config-audit: --json requires at least one exported config file');
    usage();
    process.exitCode = 2;
  } else if (!paths.length) {
    printRegistry();
  } else {
    try {
      const reports = paths.map((file) => {
        const absolute = resolve(file);
        const parsed = JSON.parse(readFileSync(absolute, 'utf8'));
        return { file: absolute, findings: auditConfig(parsed) };
      });
      if (jsonOutput) {
        console.log(JSON.stringify(reports, null, 2));
      } else {
        for (const report of reports) {
          console.log(`\n${report.file}`);
          if (!report.findings.length) {
            console.log('  No registered compatibility fields found.');
            continue;
          }
          for (const finding of report.findings) {
            console.log(`  ${finding.status.padEnd(24)} ${String(finding.count).padStart(4)}  ${finding.id}`);
            for (const match of finding.matches.slice(0, 3))
              console.log(`    ${match.path} = ${printable(match.value)}`);
            if (finding.matches.length > 3)
              console.log(`    ... ${finding.matches.length - 3} more`);
          }
        }
      }
    } catch (error) {
      console.error(`config-audit: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 2;
    }
  }
}
