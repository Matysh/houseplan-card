import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runClaudeReview, claudeInvocation } from '../lib/claude-review.mjs';
import { reviewMcpHandler } from '../lib/review-mcp.mjs';
import { REVIEW_MODEL } from '../lib/review.mjs';

const report = { verdict: 'accept', summary: 'Consistent.', understanding: 'A simple change.',
  analysis: [], blockers: [], improvements: [], boundaries: 'Source analysis only.' };
const options = { context: {}, prepared: { system: 'Independent review', packet: { authorContext: 'Task facts' } },
  model: REVIEW_MODEL, maxTurns: 150, onProgress() {}, env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: 'fixture-oauth', ANTHROPIC_API_KEY: 'must-not-use' } };

function fakeClient({ submit = true, subtype = 'success', model = REVIEW_MODEL } = {}) {
  return (_command, args, settings) => {
    assert.equal(settings.env.ANTHROPIC_API_KEY, undefined);
    assert.equal(settings.env.CLAUDE_CODE_OAUTH_TOKEN, 'fixture-oauth');
    assert.equal(args[args.indexOf('--tools') + 1], '');
    assert.equal(args.includes('--strict-mcp-config'), true);
    assert.doesNotMatch(JSON.stringify(args), /fixture-oauth/);
    const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => child.emit('close', 143);
    child.stdin.on('finish', () => {
      const mcp = JSON.parse(readFileSync(join(settings.cwd, 'mcp.json'), 'utf8')).mcpServers.review;
      if (submit) {
        const requests = [
          { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } } },
          { jsonrpc: '2.0', method: 'notifications/initialized' },
          { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'submit_review', arguments: report } },
        ];
        const output = execFileSync(mcp.command, mcp.args, { input: requests.map(JSON.stringify).join('\n') + '\n', encoding: 'utf8', windowsHide: true });
        assert.equal(JSON.parse(output.trim().split('\n').at(-1)).result.isError, undefined);
      }
      child.stdout.write(JSON.stringify({ type: 'result', subtype, is_error: subtype !== 'success', modelUsage: { [model]: {} }, num_turns: 2 }) + '\n');
      child.emit('close', 0);
    });
    return child;
  };
}

test('subscription client reaches the real stdio report tool without API billing or executable project tools', async () => {
  const result = await runClaudeReview({ ...options, spawnImpl: fakeClient() });
  assert.deepEqual(result.report, report); assert.equal(result.turns, 2);
});
test('missing report, failed client and wrong model never produce an accepted result', async () => {
  for (const value of [{ submit: false }, { subtype: 'error_max_turns' }, { model: 'claude-sonnet-5' }])
    await assert.rejects(runClaudeReview({ ...options, spawnImpl: fakeClient(value) }), /incomplete|requested review model/);
  await assert.rejects(runClaudeReview({ ...options, env: {} }), /CLAUDE_CODE_OAUTH_TOKEN/);
});
test('MCP rejects arbitrary tools and invalid verdict; successful report can only be submitted once', () => {
  let saved; const handle = reviewMcpHandler({}, value => { saved = value; });
  const call = (name, args) => handle({ id: 1, method: 'tools/call', params: { name, arguments: args } }).result;
  assert.equal(call('Bash', { command: 'npm test' }).isError, true);
  assert.equal(call('submit_review', { ...report, blockers: ['bug'] }).isError, true);
  assert.equal(saved, undefined);
  assert.equal(call('submit_review', report).isError, undefined);
  assert.deepEqual(saved, report);
  assert.equal(call('submit_review', report).isError, true);
});
