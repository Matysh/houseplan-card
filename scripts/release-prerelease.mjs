#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import {
  closeSync, mkdtempSync, openSync, readFileSync, rmSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { assertReleaseContract } from './release-contract.mjs';
import { classifyValidateRuns } from './release-gate.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

class ReleaseAssetContentError extends Error {}

export function parseIssueList(value = '') {
  if (!value.trim()) return [];
  const issues = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (issues.some((part) => !/^[1-9]\d*$/.test(part)))
    throw new Error(`--issues must be a comma-separated list of positive issue numbers: ${value}`);
  return [...new Set(issues.map(Number))];
}

export function parsePrereleaseArgs(args) {
  const values = new Map();
  const switches = new Set();
  const positionals = [];
  const valueNames = new Set(['repo', 'branch', 'project', 'issues']);
  const switchNames = new Set(['check', 'yes']);
  for (const arg of args) {
    if (!arg.startsWith('--')) { positionals.push(arg); continue; }
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    const name = match?.[1] || '';
    const value = match?.[2];
    if (switchNames.has(name) && value === undefined) {
      if (switches.has(name)) throw new Error(`Duplicate option: --${name}`);
      switches.add(name);
    } else if (valueNames.has(name) && value !== undefined && value !== '') {
      if (values.has(name)) throw new Error(`Duplicate option: --${name}`);
      values.set(name, value);
    } else {
      throw new Error(`Unknown or malformed option: ${arg}`);
    }
  }
  if (positionals.length !== 1)
    throw new Error(`Exactly one prerelease tag is required, got ${positionals.length}`);
  return {
    tag: positionals[0],
    repo: values.get('repo') || 'Matysh/houseplan-card',
    branch: values.get('branch') || 'dev',
    projectNumber: values.get('project') || '1',
    issueOption: values.get('issues') || '',
    checkOnly: switches.has('check'),
    confirmed: switches.has('yes'),
  };
}

export function verifyReleaseProjection(release, { tag }) {
  if (!release || release.tagName !== tag) throw new Error(`GitHub release ${tag} is missing`);
  if (release.isDraft) throw new Error(`GitHub release ${tag} is still a draft`);
  if (!release.isPrerelease) throw new Error(`GitHub release ${tag} is not marked as a prerelease`);
  const assets = new Map((release.assets || []).map((asset) => [asset.name, asset]));
  for (const name of ['houseplan-card.js', 'houseplan.zip']) {
    const asset = assets.get(name);
    if (!asset || !(Number(asset.size) > 0)) throw new Error(`Release asset ${name} is missing or empty`);
  }
  return release;
}

/**
 * Read selected root entries from an ordinary ZIP archive without relying on
 * platform-specific `tar`/`unzip` executables. GitHub runners, Git Bash, WSL
 * and Windows consequently validate the exact same bytes. ZIP64 and exotic
 * compression methods are rejected deliberately: release archives are small
 * and are produced by either `git archive` or Info-ZIP.
 */
export function readZipEntries(zipPath, requiredNames) {
  const archive = readFileSync(zipPath);
  if (!archive.length) throw new Error('houseplan.zip is empty');
  const required = new Set(requiredNames);
  const found = new Map();
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  const minimumEocd = 22;
  const searchStart = Math.max(0, archive.length - minimumEocd - 0xffff);
  let eocd = -1;
  for (let offset = archive.length - minimumEocd; offset >= searchStart; offset--) {
    if (archive.readUInt32LE(offset) === eocdSignature
      && offset + minimumEocd + archive.readUInt16LE(offset + 20) === archive.length) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('houseplan.zip has no end-of-central-directory record');
  const disk = archive.readUInt16LE(eocd + 4);
  const centralDisk = archive.readUInt16LE(eocd + 6);
  const entriesOnDisk = archive.readUInt16LE(eocd + 8);
  const entryCount = archive.readUInt16LE(eocd + 10);
  const centralSize = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount)
    throw new Error('houseplan.zip must be a single-disk archive');
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff)
    throw new Error('houseplan.zip unexpectedly requires ZIP64');
  if (centralOffset + centralSize > eocd || centralOffset > archive.length)
    throw new Error('houseplan.zip central directory is outside the archive');

  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== centralSignature)
      throw new Error('houseplan.zip has a malformed central directory');
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > archive.length) throw new Error('houseplan.zip has a truncated central entry');
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength)
      .toString('utf8').replace(/^\.\//, '');
    cursor = next;
    if (!required.has(name)) continue;
    if (found.has(name)) throw new Error(`houseplan.zip contains duplicate ${name}`);
    if ((flags & 0x1) !== 0) throw new Error(`houseplan.zip entry ${name} is encrypted`);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff
      || localOffset === 0xffffffff) throw new Error(`houseplan.zip entry ${name} requires ZIP64`);
    if (uncompressedSize > 50 * 1024 * 1024)
      throw new Error(`houseplan.zip entry ${name} is unexpectedly large`);
    if (localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== localSignature)
      throw new Error(`houseplan.zip entry ${name} has no valid local header`);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > archive.length) throw new Error(`houseplan.zip entry ${name} is truncated`);
    const compressed = archive.subarray(dataStart, dataEnd);
    let contents;
    if (method === 0) contents = Buffer.from(compressed);
    else if (method === 8) contents = inflateRawSync(compressed, { maxOutputLength: 50 * 1024 * 1024 });
    else throw new Error(`houseplan.zip entry ${name} uses unsupported compression method ${method}`);
    if (contents.length !== uncompressedSize)
      throw new Error(`houseplan.zip entry ${name} has an invalid uncompressed size`);
    found.set(name, contents);
  }
  if (cursor !== centralOffset + centralSize)
    throw new Error('houseplan.zip central directory size is inconsistent');
  const missing = [...required].filter((name) => !found.has(name));
  if (missing.length) throw new Error(`houseplan.zip is missing ${missing.join(', ')}`);
  return found;
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  try {
    const {
      tag, repo, branch, projectNumber, issueOption, checkOnly, confirmed,
    } = parsePrereleaseArgs(process.argv.slice(2));
  let issues = [];
  const root = process.cwd();

  const run = (command, commandArgs, { allowFailure = false, inherit = false, cwd = root } = {}) => {
    const result = spawnSync(command, commandArgs, {
      cwd,
      encoding: 'utf8',
      stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    if (result.error) throw result.error;
    if (result.status !== 0 && !allowFailure) {
      const detail = `${result.stderr || result.stdout || ''}`.trim();
      throw new Error(`${command} ${commandArgs.join(' ')} failed${detail ? `: ${detail}` : ''}`);
    }
    return {
      ok: result.status === 0,
      status: result.status,
      stdout: `${result.stdout || ''}`.trim(),
      stderr: `${result.stderr || ''}`.trim(),
    };
  };
  const ghJson = (commandArgs, options) => JSON.parse(run('gh', commandArgs, options).stdout);
  const owner = repo.split('/')[0];

  const remoteTag = () => {
    const result = run('git', [
      'ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`,
    ]);
    if (!result.stdout) return { exists: false, commit: null };
    const lines = result.stdout.split(/\r?\n/).map((line) => line.split(/\s+/));
    const direct = lines.find(([, ref]) => ref === `refs/tags/${tag}`)?.[0];
    const peeled = lines.find(([, ref]) => ref === `refs/tags/${tag}^{}`)?.[0];
    if (!peeled) throw new Error(`Remote tag ${tag} exists but is not annotated (${direct})`);
    return { exists: true, commit: peeled };
  };

  const releaseView = () => {
    const result = run('gh', [
      'release', 'view', tag, '--repo', repo,
      '--json', 'url,isPrerelease,isDraft,tagName,assets',
    ], { allowFailure: true });
    return result.ok ? JSON.parse(result.stdout) : null;
  };

  const sha256Path = (name) => createHash('sha256').update(readFileSync(name)).digest('hex');
  const sha256 = (name) => sha256Path(resolve(root, name));
  const assertBundleSnapshots = () => {
    const names = [
      'dist/houseplan-card.js',
      'custom_components/houseplan/frontend/houseplan-card.js',
      'demo/srv/assets/houseplan-card.js',
    ];
    const hashes = names.map((name) => [name, sha256(name)]);
    if (new Set(hashes.map(([, hash]) => hash)).size !== 1)
      throw new Error(`Committed bundle snapshots differ: ${hashes.map(([name, hash]) => `${name}=${hash}`).join(', ')}`);
    return hashes[0][1];
  };

  const verifyZipContents = (zipPath, version, bundleSha256) => {
    const entries = readZipEntries(zipPath, ['manifest.json', 'frontend/houseplan-card.js']);
    const manifest = JSON.parse(entries.get('manifest.json').toString('utf8'));
    if (manifest.version !== version)
      throw new Error(`houseplan.zip manifest version ${manifest.version} != ${version}`);
    const bundledHash = createHash('sha256')
      .update(entries.get('frontend/houseplan-card.js')).digest('hex');
    if (bundledHash !== bundleSha256)
      throw new Error(`houseplan.zip frontend hash ${bundledHash} != committed bundle ${bundleSha256}`);
  };

  const buildZip = (sha, version, bundleSha256, artifactsDir) => {
    const zipPath = resolve(artifactsDir, 'houseplan.zip');
    run('git', [
      'archive', '--format=zip', `--output=${zipPath}`,
      `${sha}:custom_components/houseplan`,
    ]);
    verifyZipContents(zipPath, version, bundleSha256);
    return zipPath;
  };

  const verifyRemoteAssetContents = (version, bundleSha256) => {
    const download = mkdtempSync(resolve(tmpdir(), 'houseplan-release-check-'));
    try {
      run('gh', [
        'release', 'download', tag, '--repo', repo, '--dir', download,
        '--pattern', 'houseplan-card.js', '--pattern', 'houseplan.zip', '--clobber',
      ]);
      try {
        const cardPath = resolve(download, 'houseplan-card.js');
        const cardHash = sha256Path(cardPath);
        if (cardHash !== bundleSha256)
          throw new Error(`Published houseplan-card.js hash ${cardHash} != candidate ${bundleSha256}`);
        verifyZipContents(resolve(download, 'houseplan.zip'), version, bundleSha256);
      } catch (error) {
        throw new ReleaseAssetContentError(
          error instanceof Error ? error.message : String(error),
          { cause: error },
        );
      }
    } finally {
      rmSync(download, { recursive: true, force: true });
    }
  };

  const localTag = () => {
    const exists = run('git', ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`], { allowFailure: true });
    if (!exists.ok) return { exists: false, commit: null };
    const type = run('git', ['cat-file', '-t', `refs/tags/${tag}`]).stdout;
    const commit = run('git', ['rev-list', '-n', '1', tag]).stdout;
    return { exists: true, annotated: type === 'tag', commit };
  };

  const validateIssues = () => {
    for (const issue of issues) {
      const row = ghJson(['issue', 'view', String(issue), '--repo', repo, '--json', 'number,state,url,title']);
      if (row.number !== issue) throw new Error(`Issue #${issue} could not be verified`);
    }
  };

  const assertGreenValidate = (sha) => {
    const runs = ghJson([
      'run', 'list', '--repo', repo, '--workflow', 'validate.yml', '--commit', sha,
      '--limit', '100', '--json', 'databaseId,status,conclusion,url,headSha',
    ]);
    const state = classifyValidateRuns(runs);
    if (state !== 'success') {
      throw new Error(
        state === 'wait'
          ? `Exact-SHA Validate has not completed successfully for ${sha}`
          : `Exact-SHA Validate contains a failed/cancelled run for ${sha}`,
      );
    }
    return runs;
  };

  const waitForRun = async (runId, label) => {
    let last = '';
    for (let attempt = 0; attempt < 360; attempt++) {
      const row = ghJson([
        'run', 'view', String(runId), '--repo', repo, '--json', 'status,conclusion,url',
      ]);
      const state = `${row.status}/${row.conclusion || '-'}`;
      if (state !== last) console.log(`${label}: ${state} ${row.url}`);
      last = state;
      if (row.status === 'completed') {
        if (row.conclusion !== 'success') throw new Error(`${label} concluded ${row.conclusion}: ${row.url}`);
        return row;
      }
      await sleep(10_000);
    }
    throw new Error(`${label} did not complete within one hour`);
  };

  const waitForReleaseWorkflows = async (sha) => {
    const expected = [
      ['release.yml', 'Release'],
      ['release-zip.yml', 'Attach HACS zip'],
      ['announce.yml', 'Announce release'],
    ];
    for (const [workflow, label] of expected) {
      let match = null;
      for (let attempt = 0; attempt < 300 && !match; attempt++) {
        const runs = ghJson([
          'run', 'list', '--repo', repo, '--workflow', workflow, '--event', 'release',
          '--limit', '30', '--json', 'databaseId,headBranch,headSha,status,conclusion,url',
        ]);
        match = runs.find((row) => row.headBranch === tag && row.headSha === sha) || null;
        if (!match) await sleep(2_000);
      }
      if (!match) throw new Error(`${label} workflow did not start for ${tag} at ${sha}`);
      await waitForRun(match.databaseId, label);
    }
  };

  const verifyHacsDiscovery = () => {
    const pages = ghJson(['api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`]);
    const releases = pages.flat();
    const first = releases.find((release) => release.prerelease && !release.draft);
    if (first?.tag_name !== tag) {
      throw new Error(
        `HACS prerelease discovery is stale: GitHub returns ${first?.tag_name || 'none'} before ${tag}`,
      );
    }
  };

  const finishIssues = (releaseUrl) => {
    if (!issues.length) return;
    const projectInfo = ghJson([
      'project', 'view', projectNumber, '--owner', owner, '--format', 'json',
    ]);
    const project = ghJson([
      'project', 'item-list', projectNumber, '--owner', owner, '--limit', '1000', '--format', 'json',
    ]);
    const fields = ghJson(['project', 'field-list', projectNumber, '--owner', owner, '--format', 'json']);
    const statusField = fields.fields.find((field) => field.name === 'Status');
    const done = statusField?.options?.find((entry) => entry.name === 'Done');
    if (!statusField || !done) throw new Error(`Project ${owner}/${projectNumber} has no Status=Done option`);
    const items = new Map(project.items
      .filter((item) => item.content?.repository === repo && issues.includes(item.content?.number))
      .map((item) => [item.content.number, item]));
    const missing = issues.filter((issue) => !items.has(issue));
    if (missing.length) throw new Error(`Issues are missing from Project ${projectNumber}: ${missing.join(', ')}`);

    for (const issue of issues) {
      const row = ghJson(['issue', 'view', String(issue), '--repo', repo, '--json', 'state']);
      if (row.state === 'OPEN') {
        run('gh', [
          'issue', 'close', String(issue), '--repo', repo, '--reason', 'completed',
          '--comment', `Реализовано и опубликовано в [${tag}](${releaseUrl}).`,
        ], { inherit: true });
      }
      const item = items.get(issue);
      if (item.status !== 'Done') {
        run('gh', [
          'project', 'item-edit', '--id', item.id, '--project-id', projectInfo.id,
          '--field-id', statusField.id, '--single-select-option-id', done.id,
        ]);
      }
    }
  };

  const acquireReleaseLock = () => {
    const raw = run('git', ['rev-parse', '--git-path', `houseplan-release-${tag}.lock`]).stdout;
    const lockPath = resolve(root, raw);
    let fd;
    try {
      fd = openSync(lockPath, 'wx');
    } catch (error) {
      if (error?.code === 'EEXIST')
        throw new Error(`Another local publication of ${tag} is active (${lockPath})`);
      throw error;
    }
    writeFileSync(fd, `${process.pid}\n`, 'utf8');
    return { fd, lockPath };
  };

  const releaseLock = ({ fd, lockPath }) => {
    closeSync(fd);
    try { unlinkSync(lockPath); } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  };

  const main = async () => {
    issues = parseIssueList(issueOption);
    const contract = assertReleaseContract({ root, tag, repo, requirePrerelease: true });
    run('gh', ['auth', 'status']);
    const currentBranch = run('git', ['branch', '--show-current']).stdout;
    if (currentBranch !== branch) throw new Error(`Expected branch ${branch}, got ${currentBranch || '(detached)'}`);
    if (run('git', ['status', '--porcelain']).stdout)
      throw new Error('Working tree must be clean before publication');
    run('git', ['fetch', 'origin', branch]);
    const sha = run('git', ['rev-parse', 'HEAD']).stdout;
    const remoteBranch = run('git', ['rev-parse', `origin/${branch}`]).stdout;
    if (sha !== remoteBranch) throw new Error(`HEAD ${sha} is not synchronized with origin/${branch} ${remoteBranch}`);
    const bundleSha256 = assertBundleSnapshots();
    const validateRuns = assertGreenValidate(sha);
    validateIssues();
    const existingTag = remoteTag();
    if (existingTag.exists && existingTag.commit !== sha)
      throw new Error(`Remote tag ${tag} points to ${existingTag.commit}, expected ${sha}`);
    const existingRelease = releaseView();

    console.log(JSON.stringify({
      ready: true, tag, version: contract.version, sha, branch, bundleSha256,
      validateRuns: validateRuns.map((runRow) => ({ id: runRow.databaseId, url: runRow.url })),
      remoteTag: existingTag.exists, release: existingRelease?.url || null, issues,
    }, null, 2));
    if (checkOnly) return;

    if (!confirmed) {
      if (!stdin.isTTY) throw new Error('Publication requires --yes in a non-interactive shell');
      const prompt = createInterface({ input: stdin, output: stdout });
      const answer = await prompt.question(`Type ${tag} to publish exact SHA ${sha}: `);
      prompt.close();
      if (answer.trim() !== tag) throw new Error('Publication cancelled');
    }

    const lock = acquireReleaseLock();
    let artifactsDir = null;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (artifactsDir) rmSync(artifactsDir, { recursive: true, force: true });
      releaseLock(lock);
    };
    const signalHandlers = new Map([
      ['SIGHUP', () => { try { cleanup(); } finally { process.exit(129); } }],
      ['SIGINT', () => { try { cleanup(); } finally { process.exit(130); } }],
      ['SIGTERM', () => { try { cleanup(); } finally { process.exit(143); } }],
    ]);
    for (const [signal, handler] of signalHandlers) process.once(signal, handler);
    try {
      artifactsDir = mkdtempSync(resolve(tmpdir(), 'houseplan-release-'));
      if (existingRelease && !existingRelease.isDraft) {
        let complete;
        try {
          complete = verifyReleaseProjection(existingRelease, { tag });
        } catch (error) {
          if (!/Release asset .+ is missing or empty/.test(String(error?.message || error))) throw error;
          console.log(`Published release needs asset recovery: ${error.message}`);
        }
        if (complete) {
          // A matching name and non-zero size are insufficient: bind both
          // downloadable assets to this exact candidate before closing issues.
          try {
            verifyRemoteAssetContents(contract.version, bundleSha256);
          } catch (error) {
            if (!(error instanceof ReleaseAssetContentError)) throw error;
            console.log(`Published release needs stale-asset recovery: ${error.message}`);
            complete = null;
          }
          if (complete) {
            verifyHacsDiscovery();
            finishIssues(complete.url);
            console.log(`Already published and content-verified: ${complete.url}`);
            return;
          }
        }
      }

      const zipPath = buildZip(sha, contract.version, bundleSha256, artifactsDir);
      if (!existingTag.exists) {
        const local = localTag();
        if (local.exists && (!local.annotated || local.commit !== sha)) {
          throw new Error(
            `Local tag ${tag} is ${local.annotated ? `at ${local.commit}` : 'not annotated'}, expected annotated ${sha}`,
          );
        }
        if (!local.exists) run('git', ['tag', '-a', tag, sha, '-m', tag]);
        run('git', ['push', 'origin', tag], { inherit: true });
      }

      let release = releaseView();
      if (!release) {
        run('gh', [
          'release', 'create', tag, '--repo', repo, '--verify-tag', '--draft', '--prerelease',
          '--title', tag, '--notes-file', 'docs/RELEASE-NOTES.md',
        ], { inherit: true });
        release = releaseView();
      }

      run('gh', [
        'release', 'upload', tag, 'dist/houseplan-card.js', zipPath,
        '--repo', repo, '--clobber',
      ], { inherit: true });
      const staged = releaseView();
      const stagedAssets = new Map((staged?.assets || []).map((asset) => [asset.name, asset]));
      for (const name of ['houseplan-card.js', 'houseplan.zip']) {
        if (!(Number(stagedAssets.get(name)?.size) > 0))
          throw new Error(`Draft release asset ${name} is missing or empty`);
      }

      const wasDraft = staged.isDraft;
      run('gh', [
        'release', 'edit', tag, '--repo', repo, '--draft=false', '--prerelease',
        '--title', tag, '--notes-file', 'docs/RELEASE-NOTES.md',
      ], { inherit: true });
      if (wasDraft) await waitForReleaseWorkflows(sha);

      const published = verifyReleaseProjection(releaseView(), { tag });
      const finalTag = remoteTag();
      if (!finalTag.exists || finalTag.commit !== sha)
        throw new Error(`Published tag ${tag} no longer resolves to exact SHA ${sha}`);
      verifyRemoteAssetContents(contract.version, bundleSha256);
      verifyHacsDiscovery();
      finishIssues(published.url);
      console.log(`Published and content-verified: ${published.url}`);
    } finally {
      for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
      cleanup();
    }
  };

    main().catch((error) => {
      console.error(`prerelease publication failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(`prerelease publication failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
