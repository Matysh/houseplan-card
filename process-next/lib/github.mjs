import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { initialQueueState, reduceQueue, StateConflict, LeaseLost } from './queue.mjs';

const exec = promisify(execFile);
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export function checkedRef(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
    || value.includes('..') || value.includes('//') || value.endsWith('/') || value.endsWith('.')
    || value.split('/').some(part => part.startsWith('.') || part.endsWith('.lock'))) throw Error('Unsafe Git ref');
  return value;
}
const component = value => encodeURIComponent(value);
export class GitHubError extends Error {
  constructor(status, message) { super(message); this.name = 'GitHubError'; this.status = status; }
}

/** No ambient token. Writes return a plan unless activation and credentials are explicit. */
export class GitHubClient {
  constructor({ owner, repo, token = null, activated = false, fetchImpl = globalThis.fetch,
    apiBase = 'https://api.github.com', uploadBase = 'https://uploads.github.com', requestTimeoutMs = 60000 }) {
    if (![owner, repo].every(value => typeof value === 'string' && /^[\w.-]+$/.test(value))) throw Error('Invalid repository');
    if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 60000) throw Error('GitHub request timeout must be within 1–60000 ms');
    Object.assign(this, { owner, repo, token, activated, fetchImpl, requestTimeoutMs, apiBase: apiBase.replace(/\/$/, ''), uploadBase: uploadBase.replace(/\/$/, '') });
  }
  get root() { return `/repos/${component(this.owner)}/${component(this.repo)}`; }
  async request(method, path, body, { binary = false, signal, accept = 'application/vnd.github+json' } = {}) {
    if (!path.startsWith(this.root + '/') || path.includes('://')) throw Error('Request outside configured repository');
    if (!['GET', 'HEAD'].includes(method)) {
      if (!this.activated) return { planned: true, method, path, body };
      if (!this.token) throw Error('Activated GitHub writes require explicit credentials');
    }
    const timeout = AbortSignal.timeout(this.requestTimeoutMs);
    const response = await this.fetchImpl(this.apiBase + path, { method, signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      // Response decoding is independent of the REST media type. Actions archive
      // redirects require JSON Accept even though their resulting body is a ZIP.
      headers: { Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new GitHubError(response.status, `GitHub ${method} failed (${response.status})`);
    if (response.status === 204) return null;
    return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
  }
  getRef(branch) { return this.request('GET', `${this.root}/git/ref/heads/${checkedRef(branch)}`); }
  createRef(branch, commit) {
    if (!sha(commit)) throw Error('Invalid ref commit');
    return this.request('POST', `${this.root}/git/refs`, { ref: `refs/heads/${checkedRef(branch)}`, sha: commit });
  }
  getContents(path, ref) { return this.request('GET', `${this.root}/contents/${path.split('/').map(component).join('/')}?ref=${component(ref)}`); }
  putContents(path, { branch, content, previousSha, message }) {
    return this.request('PUT', `${this.root}/contents/${path.split('/').map(component).join('/')}`,
      { branch: checkedRef(branch), content: Buffer.from(content).toString('base64'), message, ...(previousSha ? { sha: previousSha } : {}) });
  }
  updateIssue(issue, change) {
    if (!Number.isSafeInteger(issue) || issue < 1) throw Error('Invalid issue');
    return this.request('PATCH', `${this.root}/issues/${issue}`, change);
  }
  getIssue(issue) {
    if (!Number.isSafeInteger(issue) || issue < 1) throw Error('Invalid issue');
    return this.request('GET', `${this.root}/issues/${issue}`);
  }
  createIssue({ title, body, labels = [], milestone }) {
    return this.request('POST', `${this.root}/issues`, { title, body, labels, ...(milestone ? { milestone } : {}) });
  }
  async listIssueComments(issue) {
    if (!Number.isSafeInteger(issue) || issue < 1) throw Error('Invalid issue');
    const comments = [];
    for (let page = 1; page <= 100; page++) {
      const rows = await this.request('GET', `${this.root}/issues/${issue}/comments?per_page=100&page=${page}`);
      comments.push(...rows);
      if (rows.length < 100) return comments;
    }
    throw Error('Issue comment inventory incomplete');
  }
  async removeLabel(issue, label) {
    if (!Number.isSafeInteger(issue) || issue < 1 || typeof label !== 'string' || !label) throw Error('Invalid issue label');
    try { return await this.request('DELETE', `${this.root}/issues/${issue}/labels/${component(label)}`); }
    catch (error) { if (error.status !== 404) throw error; return { alreadyAbsent: true }; }
  }
  async moveStatus(issue, to, currentLabels = []) {
    if (!/^S[1-8]-[\w-]+$/.test(to)) throw Error('Invalid status label');
    const added = await this.request('POST', `${this.root}/issues/${issue}/labels`, { labels: [to] });
    const removed = [];
    for (const value of currentLabels) {
      const name = typeof value === 'string' ? value : value.name;
      if (/^S[1-8]-/.test(name) && name !== to || to === 'S8-merged' && name === 'to_release')
        removed.push(await this.removeLabel(issue, name));
    }
    return { added, removed };
  }
  comment(issue, body) {
    if (!Number.isSafeInteger(issue) || issue < 1) throw Error('Invalid issue');
    return this.request('POST', `${this.root}/issues/${issue}/comments`, { body });
  }
  async upsertComment(issue, { marker, body, allowedAuthors }) {
    if (typeof marker !== 'string' || !marker.startsWith('<!-- process-next-') || !marker.endsWith(' -->')) throw Error('Expected process comment marker');
    const text = body.startsWith(marker) ? body : `${marker}\n${body}`;
    const find = async () => (await this.listIssueComments(issue)).find(comment => comment.body?.startsWith(marker)
      && (!allowedAuthors || allowedAuthors.includes(comment.user?.login ?? comment.author)));
    const existing = await find();
    // The compatibility name is retained for callers. A marker identifies an
    // event, not a mutable dashboard: changed wording never rewrites history.
    if (existing) return { ...existing, reused: true };
    try { return await this.comment(issue, text); }
    catch (error) {
      // POST may have succeeded before its response was lost. Never blindly
      // repeat it; the existing serialized publisher can retry a later read.
      const delivered = await find().catch(() => null);
      if (delivered) return { ...delivered, reused: true };
      throw error;
    }
  }
  getRelease(tag) { return this.request('GET', `${this.root}/releases/tags/${component(tag)}`); }
  async findRelease(tag) {
    try { return await this.getRelease(tag); } catch (error) { if (error.status !== 404) throw error; }
    // GitHub's tag endpoint may not expose a draft. Do not create duplicate drafts on retry.
    const matches = [];
    for (let page = 1; page <= 100; page++) {
      const rows = await this.request('GET', `${this.root}/releases?per_page=100&page=${page}`);
      matches.push(...rows.filter(row => row.tag_name === tag));
      if (matches.length > 1) throw Error('Several releases claim this tag');
      if (rows.length < 100) return matches[0] ?? null;
    }
    throw Error('Release inventory incomplete');
  }
  createDraftRelease({ tag, sourceSha, prerelease, body }) {
    return this.request('POST', `${this.root}/releases`, { tag_name: tag, target_commitish: sourceSha, draft: true, prerelease, body });
  }
  updateRelease(id, change) { return this.request('PATCH', `${this.root}/releases/${id}`, change); }
  async uploadReleaseAsset(id, { name, bytes, contentType = 'application/octet-stream' }) {
    if (!Number.isSafeInteger(id) || id < 1 || !Buffer.isBuffer(bytes)) throw Error('Invalid upload');
    if (!this.activated) return { planned: true, release: id, name, bytes: bytes.length };
    if (!this.token) throw Error('Activated GitHub writes require explicit credentials');
    const response = await this.fetchImpl(`${this.uploadBase}${this.root}/releases/${id}/assets?name=${component(name)}`, {
      signal: AbortSignal.timeout(this.requestTimeoutMs),
      method: 'POST', headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json',
        'Content-Type': contentType, 'Content-Length': String(bytes.length), 'X-GitHub-Api-Version': '2022-11-28' }, body: bytes });
    if (!response.ok) throw new GitHubError(response.status, `GitHub asset upload failed (${response.status})`);
    return response.json();
  }
  async verifyPublication({ tag, expectedSha, assetName, expectedDigest }) {
    if (!sha(expectedSha) || !/^[a-f0-9]{64}$/.test(expectedDigest ?? '')) throw Error('Expected commit and artifact digest required');
    const release = await this.getRelease(tag);
    if (release.draft || release.tag_name !== tag) throw Error('Release is not published');
    let object = (await this.request('GET', `${this.root}/git/ref/tags/${component(tag)}`)).object;
    for (let depth = 0; object.type === 'tag' && depth < 8; depth++)
      object = (await this.request('GET', `${this.root}/git/tags/${object.sha}`)).object;
    if (object.type !== 'commit' || object.sha !== expectedSha) throw Error('Published tag points to another commit');
    const assets = release.assets.filter(asset => asset.name === assetName);
    if (assets.length !== 1) throw Error('Release artifact missing or ambiguous');
    const actual = sha256(await this.downloadAsset(assets[0].id));
    if (actual !== expectedDigest) throw Error('Published artifact differs from the checked artifact');
    return { tag, sha: expectedSha, artifactDigest: actual, releaseId: release.id, assetId: assets[0].id };
  }
  downloadAsset(id) {
    if (!Number.isSafeInteger(id) || id < 1) throw Error('Invalid asset ID');
    return this.request('GET', `${this.root}/releases/assets/${id}`, undefined, { binary: true, accept: 'application/octet-stream' });
  }
}

/** One dedicated state file/branch. Never creates a missing branch as a side effect of reading. */
export class GitHubQueueStore {
  constructor(client, { branch = 'process-state', path = 'queue.json', initial = initialQueueState } = {}) {
    if (!/^[\w./-]+$/.test(path) || path.split('/').includes('..')) throw Error('Unsafe state path');
    Object.assign(this, { client, branch: checkedRef(branch), path, initial });
  }
  async read() {
    let head;
    try { head = (await this.client.getRef(this.branch)).object.sha; }
    catch (error) { if (error.status === 404) throw Error(`State branch ${this.branch} is not initialized; explicit activation/initialization required`); throw error; }
    const file = await this.client.getContents(this.path, head);
    if (file.encoding !== 'base64' || !sha(file.sha)) throw Error('Invalid GitHub state content');
    return { state: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')),
      version: { blobSha: file.sha, headSha: head }, headSha: head };
  }
  async compareAndSwap(version, state) {
    if (!this.client.activated) throw Error('Remote queue writes are disabled; use LocalQueueStore for a draft');
    try {
      if ((await this.client.getRef(this.branch)).object.sha !== version.headSha) throw new StateConflict();
      const result = await this.client.putContents(this.path, { branch: this.branch, previousSha: version.blobSha,
        content: JSON.stringify(state, null, 2) + '\n', message: 'process-next: queue state' });
      return { blobSha: result.content.sha, headSha: result.commit.sha };
    } catch (error) { if ([409, 422].includes(error.status)) throw new StateConflict(); throw error; }
  }
  async initialize({ baseSha, confirmed = false } = {}) {
    if (!confirmed || !this.client.activated) throw Error('State initialization needs explicit activation and confirmation');
    if (!sha(baseSha)) throw Error('State initialization requires a base commit');
    let exists = true;
    try { await this.client.getRef(this.branch); }
    catch (error) { if (error.status !== 404) throw error; exists = false; }
    if (exists) throw Error('State branch already exists; inspect it instead of reinitializing');
    // Keep ancestry, not the source tree: inherited workflows run on state writes.
    // Publish the ref only after the state-only tree is complete.
    const tree = await this.client.request('POST', `${this.client.root}/git/trees`, {
      tree: [{ path: this.path, mode: '100644', type: 'blob', content: JSON.stringify(this.initial(), null, 2) + '\n' }],
    });
    const commit = await this.client.request('POST', `${this.client.root}/git/commits`, {
      message: 'process-next: initialize state-only branch', tree: tree.sha, parents: [baseSha],
    });
    return this.client.createRef(this.branch, commit.sha);
  }
}

export async function runGit(args, { cwd, env = {}, input } = {}) {
  // execFile has no shell; input goes through stdin, never an interpolated command.
  const failure = error => Object.assign(new Error(`Git ${args[0]} failed (exit ${error.code ?? 'launch'})`), { code: error.code });
  if (input !== undefined) return new Promise((resolve, reject) => {
    const child = execFile('git', args, { cwd, env: { ...process.env, ...env }, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => error ? reject(failure(error)) : resolve({ stdout, stderr }));
    child.stdin.end(input);
  });
  return exec('git', args, { cwd, env: { ...process.env, ...env }, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }).catch(error => { throw failure(error); });
}

export class GitAdapter {
  constructor({ cwd, remote = 'origin', dev = 'dev', activated = false, run = runGit, clock = Date.now } = {}) {
    if (typeof remote !== 'string' || !/^[\w.-]+$/.test(remote)) throw Error('Use a configured Git remote name');
    Object.assign(this, { cwd, remote, dev: checkedRef(dev), activated, run, clock });
  }
  async git(args, options = {}) { return (await this.run(args, { cwd: this.cwd, ...options })).stdout.trim(); }
  async remoteHead(branch) {
    const output = await this.git(['ls-remote', '--refs', this.remote, `refs/heads/${checkedRef(branch)}`]);
    return output ? output.split(/\s+/)[0] : null;
  }
  async assertAncestor(base, head) {
    if (!sha(base) || !sha(head)) throw Error('Expected immutable Git commits');
    await this.git(['merge-base', '--is-ancestor', base, head]);
  }
  async ensureCommit(commit) {
    if (!sha(commit)) throw Error('Expected immutable commit');
    try { await this.git(['cat-file', '-e', `${commit}^{commit}`]); }
    catch { await this.git(['fetch', '--no-tags', this.remote, commit]); await this.git(['cat-file', '-e', `${commit}^{commit}`]); }
  }
  async stateCommit({ parent, path, state }) {
    const index = join(tmpdir(), `houseplan-queue-${randomUUID()}.index`), env = { GIT_INDEX_FILE: index };
    try {
      await this.git(['read-tree', parent], { env });
      const blob = await this.git(['hash-object', '-w', '--stdin'], { input: JSON.stringify(state, null, 2) + '\n' });
      await this.git(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env });
      const tree = await this.git(['write-tree'], { env });
      return this.git(['commit-tree', tree, '-p', parent, '-m', 'process-next: merged task'], {
        env: { GIT_AUTHOR_NAME: 'Houseplan process', GIT_AUTHOR_EMAIL: 'process@localhost',
          GIT_COMMITTER_NAME: 'Houseplan process', GIT_COMMITTER_EMAIL: 'process@localhost' } });
    } finally { await unlink(index).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  /** Both refs are proved fast-forward before an atomic expected-head update.
   * --force-with-lease expresses CAS here; a non-fast-forward candidate is never submitted.
   * Queue completion and dev publication occur together: an expired worker cannot use an old fence.
   */
  async merge({ expectedBase, materialSha, branch, fence, comment } = {}) {
    checkedRef(branch);
    if (!sha(expectedBase) || !sha(materialSha) || !fence || !sha(fence.headSha)) throw Error('Merge needs immutable base/material and queue fence');
    const stateBranch = checkedRef(fence.branch ?? 'process-state'), statePath = fence.path ?? 'queue.json';
    if ([this.dev, 'main', stateBranch].includes(branch)) throw Error('Task material must use a separate task branch');
    if ([this.dev, branch].includes(stateBranch) || !/^[\w./-]+$/.test(statePath) || statePath.split('/').includes('..')) throw Error('Invalid state fence');
    const active = fence.state?.active;
    if (!active || active.token !== fence.token || active.issue !== fence.issue || active.expiresAt <= this.clock()) throw new LeaseLost();
    if (active.materialSha !== materialSha || active.expectedBase !== expectedBase || active.phase !== 'ready-to-merge') throw Error('Queue fence does not authorize this merge');
    const nextState = reduceQueue(fence.state, { id: fence.eventId ?? `merge:${active.token}`, type: 'merged', issue: active.issue,
      token: active.token, materialSha, actualDevSha: materialSha, branchDeleted: true,
      fromStatus: fence.fromStatus, removedToRelease: fence.removedToRelease }, { now: this.clock() });
    if (!this.activated) return { planned: true, expectedBase, materialSha, branch, stateBranch, nextState,
      operation: 'atomic fast-forward dev and queue state; conditionally delete unchanged task branch' };
    for (const commit of [expectedBase, materialSha, fence.headSha]) await this.ensureCommit(commit);
    await this.assertAncestor(expectedBase, materialSha);
    if (await this.remoteHead(this.dev) !== expectedBase || await this.remoteHead(branch) !== materialSha
      || await this.remoteHead(stateBranch) !== fence.headSha) throw new StateConflict('Remote refs changed before merge');
    const stored = JSON.parse(await this.git(['show', `${fence.headSha}:${statePath}`]));
    if (JSON.stringify(stored) !== JSON.stringify(fence.state)) throw Error('Queue snapshot differs from its immutable commit');
    const nextFence = await this.stateCommit({ parent: fence.headSha, path: statePath, state: nextState });
    await this.assertAncestor(fence.headSha, nextFence);
    if (active.expiresAt <= this.clock()) throw new LeaseLost();
    const args = ['push', '--atomic', `--force-with-lease=refs/heads/${this.dev}:${expectedBase}`,
      `--force-with-lease=refs/heads/${stateBranch}:${fence.headSha}`,
      `--force-with-lease=refs/heads/${branch}:${materialSha}`, this.remote,
      `${materialSha}:refs/heads/${this.dev}`, `${nextFence}:refs/heads/${stateBranch}`, `:refs/heads/${branch}`];
    try { await this.git(args); }
    catch (error) {
      // An accepted push can lose its response. Exact remote refs establish success, not a comment/API result.
      const currentDev = await this.remoteHead(this.dev), currentState = await this.remoteHead(stateBranch);
      if (currentDev !== materialSha || currentState !== nextFence) {
        if (currentDev === expectedBase && await this.remoteHead(branch) === materialSha && currentState !== fence.headSha)
          throw new StateConflict('Queue metadata changed during merge; refresh the same admission');
        throw error;
      }
    }
    const result = { merged: true, status: 'S8-merged', materialSha, state: nextState, stateCommit: nextFence, statePersisted: true,
      branchDeleted: true, warnings: [] };
    if (comment) try { await comment(result); } catch { result.warnings.push('Merged; comment publication needs retry'); }
    return result;
  }
  async deleteBranchIfUnchanged(branch, expectedSha) {
    checkedRef(branch);
    if ([this.dev, 'main', 'process-state'].includes(branch) || !sha(expectedSha)) throw Error('Protected/invalid branch deletion');
    if (!this.activated) return { planned: true, branch, expectedSha };
    if (await this.remoteHead(branch) !== expectedSha) return false;
    try { await this.git(['push', `--force-with-lease=refs/heads/${branch}:${expectedSha}`, this.remote, `:refs/heads/${branch}`]); return true; }
    catch (error) { if (await this.remoteHead(branch) !== expectedSha) return false; throw error; }
  }
  async publishCandidateRefs({ materialSha, tag, kind, expectedMain, checkOnly = false }) {
    checkedRef(tag);
    if (!sha(materialSha) || !['beta', 'stable', 'hotfix'].includes(kind)) throw Error('Invalid release material');
    if (kind !== 'beta' && !sha(expectedMain)) throw Error('Stable/hotfix requires the observed main head');
    if (!this.activated) return { planned: true, materialSha, tag, kind, expectedMain, operation: 'publish immutable tag and fast-forward main for stable/hotfix' };
    await this.ensureCommit(materialSha);
    const rows = (await this.git(['ls-remote', '--tags', this.remote, `refs/tags/${tag}`, `refs/tags/${tag}^{}`])).split('\n').filter(Boolean);
    const existingTag = (rows.find(row => row.endsWith('^{}')) ?? rows[0])?.split(/\s+/)[0];
    if (existingTag && existingTag !== materialSha) throw Error('Existing tag points to different material; it will not be replaced');
    const refs = [], leases = [];
    if (!existingTag) { refs.push(`${materialSha}:refs/tags/${tag}`); leases.push(`--force-with-lease=refs/tags/${tag}:`); }
    if (kind !== 'beta') {
      const current = await this.remoteHead('main');
      await this.ensureCommit(current);
      if (current !== expectedMain) {
        // Retry after refs were published but an API/upload response failed: no new main update.
        let alreadyIncluded = false;
        if (existingTag) try { await this.assertAncestor(materialSha, current); alreadyIncluded = true; } catch { /* real race below */ }
        if (alreadyIncluded) return { publishedRefs: true, tag, materialSha, mainAlreadyContains: true };
        throw new StateConflict('Main changed before publication');
      }
      if (current !== materialSha) {
        if (existingTag) {
          // Retrying an older, already-published tag may observe a newer stable. Never move main backwards.
          let alreadyIncluded = false;
          try { await this.assertAncestor(materialSha, current); alreadyIncluded = true; } catch { /* need a forward promotion below */ }
          if (alreadyIncluded) return { publishedRefs: true, tag, materialSha, mainAlreadyContains: true };
        }
        try { await this.assertAncestor(current, materialSha); }
        catch { throw Error('Release candidate does not contain the published stable/hotfix history; return that tag to dev through the queue and select a new candidate'); }
        refs.push(`${materialSha}:refs/heads/main`); leases.push(`--force-with-lease=refs/heads/main:${current}`);
      }
    }
    if (checkOnly) return { checked: true, materialSha, tag, expectedMain };
    if (!existingTag) {
      // Preserve the public annotated-tag format without creating/moving a local tag ref.
      const object = `object ${materialSha}\ntype commit\ntag ${tag}\ntagger Houseplan release <process@localhost> ${Math.floor(this.clock() / 1000)} +0000\n\nRelease ${tag}\n`;
      const tagObject = await this.git(['mktag'], { input: object });
      refs[0] = `${tagObject}:refs/tags/${tag}`;
    }
    if (refs.length) await this.git(['push', '--atomic', ...leases, this.remote, ...refs]);
    return { publishedRefs: true, tag, materialSha };
  }
}

export const sha256 = value => createHash('sha256').update(value).digest('hex');
