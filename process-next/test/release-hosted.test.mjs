import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { completeHostedRelease } from '../templates/release-complete-job.mjs';
import { executeRemoteCommand } from '../remote.mjs';
import { initialReleaseState } from '../lib/release.mjs';
import { MemoryQueueStore, QueueController } from '../lib/queue.mjs';

test('hosted completion uses stored HACS observation and its Telegram credentials without HA access or republishing', async () => {
  const sha = 'a'.repeat(40), digest = 'd'.repeat(64), tag = 'v2.0.0';
  const candidate = { id: 'stable-2', kind: 'stable', status: 'published', sha, tag,
    membership: { schema: 1, candidate: sha, base: 'b'.repeat(40), issues: [] },
    publication: { artifactDigest: digest },
    delivery: { hacsAvailable: true, tag, artifactDigest: digest },
    completion: { 'return-to-dev': { status: 'completed' } },
    releaseData: { userChangelog: { ru: '<!-- release: v2.0.0 -->\n<!-- base: v1.0.0 -->\n## Релиз Houseplan 2.0.0\n\nСохранённое пользовательское изменение.\n' } } };
  const releaseStore = new MemoryQueueStore({ ...initialReleaseState(), candidates: { [candidate.id]: candidate } });
  const env = { PROCESS_NEXT_ENABLED: 'true', HP_PROCESS_NEXT_ACTIVATE: '1', HP_RELEASE_CANDIDATE: candidate.id,
    GITHUB_RUN_ID: '41', GITHUB_RUN_ATTEMPT: '1', TELEGRAM_BOT_TOKEN: '12345:hosted-token', TELEGRAM_CHAT_ID: 'channel' };
  const config = { enabled: true, owner: 'owner', repo: 'repo', hacs: { url: '', tokenEnv: 'HA_TOKEN' } };
  let sends = 0;
  const execute = options => {
    assert.equal(options.command, 'complete-release');
    assert.equal(options.event.candidate, candidate.id);
    assert.equal(options.config.release.returnS6, 'github');
    return executeRemoteCommand({ ...options, dependencies: { api: {}, git: {}, releaseStore,
      queue: new QueueController(new MemoryQueueStore()),
      fetchImpl: async (url, init) => {
        sends++;
        assert.equal(url, 'https://api.telegram.org/bot12345:hosted-token/sendMessage');
        const payload = JSON.parse(init.body);
        assert.equal(payload.chat_id, 'channel');
        assert.match(payload.text, /Сохранённое пользовательское изменение/);
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 12 } }) };
      } } });
  };
  const first = await completeHostedRelease({ env, config, execute });
  assert.equal(first.completion.status, 'completed');
  assert.equal(first.state.candidates[candidate.id].announcement.status, 'sent');
  const repeated = await completeHostedRelease({ env: { ...env, GITHUB_RUN_ATTEMPT: '2' }, config, execute });
  assert.equal(repeated.completion.status, 'completed');
  assert.equal(sends, 1);
});

test('beta completion verifies public discovery and ZIP bytes without HA or Telegram credentials', async () => {
  const bytes = Buffer.from('published beta ZIP');
  const candidate = { id: 'beta', kind: 'beta', status: 'published', sha: 'a'.repeat(40), tag: 'v2.0.0-beta.1',
    membership: { schema: 1, candidate: 'a'.repeat(40), base: 'b'.repeat(40), issues: [] },
    publication: { artifactDigest: createHash('sha256').update(bytes).digest('hex') } };
  const releaseStore = new MemoryQueueStore({ ...initialReleaseState(), candidates: { beta: candidate } });
  const release = { draft: false, prerelease: true, tag_name: candidate.tag, assets: [{ id: 1, name: 'houseplan.zip' }] };
  const api = { owner: 'owner', repo: 'repo', root: '/repos/owner/repo',
    request: async (method, path) => { assert.equal(method, 'GET'); assert.match(path, /\/releases\?/); return [release]; },
    getRelease: async () => release, downloadAsset: async () => bytes };
  const result = await executeRemoteCommand({ command: 'complete-release', execute: true,
    config: { enabled: true, owner: 'owner', repo: 'repo' }, env: { HP_PROCESS_NEXT_ACTIVATE: '1' },
    event: { id: 'public-discovery', candidate: 'beta' },
    dependencies: { api, git: {}, releaseStore, queue: new QueueController(new MemoryQueueStore()) } });
  assert.equal(result.completion.status, 'completed');
  const recorded = (await releaseStore.read()).state.candidates.beta;
  assert.equal(recorded.delivery.discoveryAvailable, true);
  assert.equal(recorded.delivery.hacsAvailable, undefined);
  assert.equal(recorded.announcement, undefined);
});
