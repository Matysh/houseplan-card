// #916: an explicit reviewed owner decision, never an invented field receipt.
import { fingerprintCorpus } from './source-fingerprint.mjs';
import { classify } from './change-classes.mjs';

const versionFiles = new Set(['package.json', 'package-lock.json',
  'custom_components/houseplan/manifest.json', 'custom_components/houseplan/const.py',
  'src/houseplan-card.ts', 'src/houseplan-editor-runtime.ts']);
const infrastructureScripts = new Set(['scripts/check-inputs.mjs', 'scripts/release-ledger.mjs',
  'scripts/stable-field-decision.mjs', 'scripts/candidate-readiness.mjs', 'scripts/release-prepare.mjs']);

function versionProjection(text, path, version) {
  if (path.endsWith('.json')) {
    const value = JSON.parse(text);
    if (value.version !== version || (path === 'package-lock.json' && value.packages?.['']?.version !== version))
      throw Error(`Promotion version mismatch: ${path}`);
    value.version = '<product-version>';
    if (path === 'package-lock.json') value.packages[''].version = '<product-version>';
    return JSON.stringify(value);
  }
  const name = path.endsWith('/const.py') ? 'VERSION' : 'CARD_VERSION';
  let count = 0;
  const result = text.replace(new RegExp(`(\\b${name}\\s*=\\s*)(['"])([^'"]+)\\2`, 'g'), (_all, prefix, quote, value) => {
    if (value !== version) throw Error(`Promotion version mismatch: ${path}`);
    count++;
    return `${prefix}${quote}<product-version>${quote}`;
  });
  if (count !== 1) throw Error(`Promotion needs exactly one version assignment: ${path}`);
  return result;
}

export function readStableFieldDecision({ candidate, version, root, git }) {
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) return null;
  const path = `docs/release-ledger/field-decisions/v${version}.json`;
  if (!git(['ls-tree', candidate, '--', path]).trim()) return null;
  const record = JSON.parse(git(['show', `${candidate}:${path}`]));
  if (record.schema !== 1 || record.tag !== `v${version}`
    || !/^v\d+\.\d+\.\d+-beta\.[1-9]\d*$/.test(record.testedTag || '')
    || !record.testedTag.startsWith(`${record.tag}-beta.`)
    || !/^[a-f0-9]{40}$/.test(record.testedSha || '')
    || !Number.isSafeInteger(record.issue) || record.issue <= 0)
    throw Error('Invalid reviewed stable field decision');
  if (git(['rev-parse', `${record.testedTag}^{commit}`]).trim() !== record.testedSha)
    throw Error('Owner-tested prerelease tag changed');
  git(['merge-base', '--is-ancestor', record.testedSha, candidate]);
  const capture = new Set(fingerprintCorpus(root));
  const changes = git(['diff', '--name-only', record.testedSha, candidate]).trim().split('\n').filter(Boolean).sort();
  for (const file of changes) {
    if (versionFiles.has(file)) {
      const before = versionProjection(git(['show', `${record.testedSha}:${file}`]), file, record.testedTag.slice(1));
      const after = versionProjection(git(['show', `${candidate}:${file}`]), file, version);
      if (before !== after) throw Error(`Product changed since owner-tested prerelease: ${file}`);
    } else if (file.startsWith('dist/') || file.startsWith('custom_components/houseplan/frontend/')) {
      // candidateInputs independently verifies both generated trees and freshness.
      continue;
    } else if (capture.has(file) || classify(file) === 'A' || file.startsWith('demo/')
      || !(classify(file) === 'C' || infrastructureScripts.has(file)
        || /^(?:test\/|\.github\/|\.githooks\/)/.test(file))) {
      throw Error(`Unreviewed product/build/capture input since owner-tested prerelease: ${file}`);
    }
  }
  return { ...record, productEquivalent: true, changes };
}

export function stableFieldDecisionRefusal(decision, record, { version, owner }) {
  if (!decision || decision.tag !== `v${version}` || decision.productEquivalent !== true)
    return 'missing/mismatched product-equivalent stable field decision';
  if (!record || record.invalid || record.schema !== 1 || record.verdict !== 'accepted'
    || record.tag !== decision.tag || record.testedTag !== decision.testedTag || record.testedSha !== decision.testedSha
    || record.source !== 'owner-chat' || record.recordedBy !== 'agent'
    || record.owner !== owner || record.acceptance !== 'stand-passed'
    || record.linkedPerIssueRecords !== 'waived-for-this-promotion'
    || !Array.isArray(record.statements) || !record.statements.length
    || record.statements.some(value => typeof value !== 'string' || !value.trim()))
    return 'missing/revoked authenticated owner decision for this exact promotion';
  return null;
}
