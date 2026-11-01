import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Use the official Claude Code client with the owner's existing subscription.
// The model has only our read-only Git tools; no shell, edits, hooks or project MCP.
export function claudeInvocation({ directory, model, maxTurns }) {
  return ['--print', '--model', model, '--effort', 'high', '--max-turns', String(maxTurns),
    '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
    '--setting-sources', '', '--settings', join(directory, 'settings.json'),
    '--strict-mcp-config', '--mcp-config', join(directory, 'mcp.json'),
    '--tools', '', '--allowedTools', 'mcp__review__*',
    '--system-prompt-file', join(directory, 'system.txt')];
}

export async function runClaudeReview({ context, prepared, model, maxTurns, onProgress,
  env = process.env, spawnImpl = spawn }) {
  if (!env.CLAUDE_CODE_OAUTH_TOKEN) throw Error('CLAUDE_CODE_OAUTH_TOKEN is required for subscription review');
  const directory = mkdtempSync(join(tmpdir(), 'houseplan-review-'));
  const childEnv = { ...env, DISABLE_AUTOUPDATER: '1' };
  // Never silently switch billing to a separately configured API key/provider.
  for (const key of Object.keys(childEnv)) if (/^(ANTHROPIC_|CLAUDE_CODE_USE_|CLAUDE_CONFIG_DIR$|CLAUDE_CODE_OAUTH_TOKEN_FILE$)/.test(key)) delete childEnv[key];
  try {
    writeFileSync(join(directory, 'context.json'), JSON.stringify(context));
    writeFileSync(join(directory, 'system.txt'), prepared.system);
    writeFileSync(join(directory, 'settings.json'), JSON.stringify({ disableAllHooks: true, enabledPlugins: {}, permissions: { defaultMode: 'dontAsk' } }));
    writeFileSync(join(directory, 'mcp.json'), JSON.stringify({ mcpServers: { review: {
      command: process.execPath, args: [fileURLToPath(new URL('./review-mcp.mjs', import.meta.url)), directory],
    } } }));
    const result = await new Promise((resolve, reject) => {
      const child = spawnImpl('claude', claudeInvocation({ directory, model, maxTurns }), {
        cwd: directory, env: childEnv, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      });
      let pending = '', final = null, stderr = '', invalid = null;
      const timer = setTimeout(() => { invalid = Error('Claude Code review timed out; no complete verdict'); child.kill('SIGTERM'); }, 45 * 60_000);
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      const consume = line => {
        if (!line.trim()) return;
        let event; try { event = JSON.parse(line); } catch { invalid = Error('Invalid Claude Code result stream'); return; }
        if (event.type === 'result') final = event;
        if (event.type === 'assistant') for (const block of event.message?.content ?? []) {
          if (block.type === 'tool_use') onProgress({ phase: 'review', tool: block.name });
        }
      };
      child.stdout.on('data', chunk => {
        pending += chunk;
        let end; while ((end = pending.indexOf('\n')) >= 0) { consume(pending.slice(0, end)); pending = pending.slice(end + 1); }
        if (pending.length > 8 * 1024 * 1024) { invalid = Error('Claude Code output exceeded limit'); child.kill('SIGTERM'); }
      });
      // Keep diagnostics bounded; never print client stderr, which may contain credentials.
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4096); });
      child.on('error', error => { clearTimeout(timer); reject(Error(`Claude Code could not start: ${error.code ?? 'spawn error'}`)); });
      child.on('close', code => {
        clearTimeout(timer); consume(pending);
        if (invalid) return reject(invalid);
        if (code !== 0 || !final || final.is_error || final.subtype !== 'success')
          return reject(Error(`Claude Code review incomplete (exit ${code}, ${final?.subtype ?? 'no result'}); check subscription authentication/limits in Actions`));
        const models = Object.keys(final.modelUsage ?? {});
        if (models.length && !models.includes(model)) return reject(Error('Claude Code did not use the requested review model'));
        resolve(final);
      });
      child.stdin.end(JSON.stringify(prepared.packet));
    });
    let report;
    try { report = JSON.parse(readFileSync(join(directory, 'submission.json'), 'utf8')); }
    catch { throw Error('Review incomplete: Claude Code did not submit a structured review'); }
    return { report, usage: result.usage ?? null, turns: result.num_turns ?? null };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
