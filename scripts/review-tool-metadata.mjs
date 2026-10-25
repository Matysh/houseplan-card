// #1082: safe shape only, not a tool policy or an execution capability.
import { createHash } from 'node:crypto';
const words = value => new Set(value.split(' '));
const TOOLS = words('Read Write Edit MultiEdit Grep Glob Bash TodoWrite ToolSearch StructuredOutput EndConversation Task Agent WebFetch WebSearch Skill ExitPlanMode EnterPlanMode mcp__github__add_issue_comment mcp__github__issue_write mcp__github__issue_read');
const KEYS = words('command description timeout run_in_background file_path content old_string new_string replace_all edits pattern path glob type output_mode head_limit offset limit multiline case_insensitive query url prompt owner repo issue_number body comment method perPage page tool_name tool_use_id tool_input');
const BINS = words('node git rg sed npm npx python python3 pwd ls cat head tail wc');
const FLAGS = words('--test --check --write --fix --apply --accept --execute-nightly --return --seal --publish --push --force -e -i --eval --expression --file --output --output-indicator-new --ext-diff --textconv --filters --open-files-in-pager --test-name-pattern --test-concurrency --report --no-install --no-ext-diff --no-textconv -n -p -m -q -x');
const FIELDS = ['offset', 'limit', 'head_limit', 'timeout', 'run_in_background', 'replace_all', 'multiline', 'case_insensitive'];
const types = ['undefined', 'null', 'array', 'object', 'string', 'boolean', 'number', 'unknown'];
export const metadataDigest = value => { try { return createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex'); } catch { return null; } };
export const knownToolName = value => TOOLS.has(value) ? value : 'other';
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const typeOf = value => value === null ? 'null' : Array.isArray(value) ? 'array' : types.includes(typeof value) ? typeof value : 'unknown';
const safeNumber = value => Number.isFinite(value) && Math.abs(value) <= 1e9;
const DECISIONS = new Map([
  ['only one foreground literal command is permitted', 'nonliteral-or-background'],
  ['Node entry must be an unchanged tracked file', 'untracked-node-entry'],
  ['write/execute override is forbidden', 'write-or-execute-override'],
  ['mutation execution is forbidden', 'mutation-execution'],
  ['command is outside the review check allowlist; use read tools or existing CI evidence', 'command-not-allowlisted'],
  ['spec feasibility checks do not build or launch browsers/backend', 'spec-execution-boundary'],
  ['tool is not permitted by the review execution boundary', 'tool-not-allowlisted'],
  ['malformed tool call', 'malformed-tool'],
  ['Write is restricted to the external review report/findings', 'write-target'],
  ['symlink output is forbidden', 'write-symlink'], ['output parent is unavailable', 'write-parent'],
  ['external report must be text without misleading ordinary mutation claims', 'report-claim-or-type'],
  ['misleading ordinary mutation claim cannot be published', 'report-claim'],
]);
const categories = new Set(['allowed', 'other-policy-refusal', 'policy-unavailable', 'policy-evaluation-unavailable', ...DECISIONS.values()]);
export function reviewDecisionMetadata(reason) {
  return { category: reason === null ? 'allowed' : DECISIONS.get(reason)
    ?? (['policy-unavailable', 'policy-evaluation-unavailable'].includes(reason) ? reason : 'other-policy-refusal'),
  reasonDigest: typeof reason === 'string' ? metadataDigest(reason) : null };
}
export const projectStoredDecision = value => value && categories.has(value.category)
  ? { category: value.category, reasonDigest: hex(value.reasonDigest) } : null;

export function reviewToolMetadata(name, input, { files = [], literalArgv } = {}) {
  const keys = input && typeof input === 'object' && !Array.isArray(input) ? Object.keys(input) : [];
  const fields = FIELDS.filter(key => Object.hasOwn(input ?? {}, key)).map(key => {
    const value = input[key], type = typeOf(value);
    return { key, type, ...(type === 'boolean' || type === 'number' && safeNumber(value) ? { value } : {}) };
  });
  const argv = typeof input?.command === 'string' && literalArgv ? literalArgv(input.command) : null;
  return { schema: 1, tool: knownToolName(name), toolNameDigest: metadataDigest(name), inputDigest: metadataDigest(input),
    inputType: typeOf(input), keys: keys.filter(key => KEYS.has(key)), otherKeyCount: keys.filter(key => !KEYS.has(key)).length,
    orderedKeyDigests: keys.slice(0, 48).map(metadataDigest), omittedKeys: Math.max(0, keys.length - 48), fields,
    command: typeof input?.command !== 'string' ? null : { literal: Boolean(argv), bytes: Buffer.byteLength(input.command),
      binary: argv ? (BINS.has(argv[0]) ? argv[0] : 'other') : 'unknown', argumentCount: argv ? argv.length - 1 : null,
      flags: argv ? [...new Set(argv.slice(1).map(arg => arg.split('=')[0]).filter(arg => FLAGS.has(arg)))].sort() : [],
      trackedOperands: argv ? argv.slice(1).filter(arg => Array.isArray(files) && files.includes(arg)).length : null,
      background: input.run_in_background === true } };
}

/** Never copy a journal's arbitrary objects/strings into an uploaded certificate. */
export function projectStoredToolMetadata(value) {
  if (!value || value.schema !== 1 || !Array.isArray(value.keys) || !Array.isArray(value.orderedKeyDigests)
    || !Array.isArray(value.fields)) return null;
  const command = value.command;
  return { schema: 1, tool: knownToolName(value.tool), toolNameDigest: hex(value.toolNameDigest), inputDigest: hex(value.inputDigest),
    inputType: types.includes(value.inputType) ? value.inputType : 'unknown',
    keys: value.keys.filter(key => KEYS.has(key)).slice(0, KEYS.size), otherKeyCount: count(value.otherKeyCount),
    orderedKeyDigests: value.orderedKeyDigests.slice(0, 48).map(hex), omittedKeys: count(value.omittedKeys),
    fields: value.fields.filter(row => FIELDS.includes(row?.key)).slice(0, FIELDS.length).map(row => ({ key: row.key,
      type: types.includes(row.type) ? row.type : 'unknown',
      ...(row.type === 'boolean' && typeof row.value === 'boolean' || row.type === 'number' && safeNumber(row.value)
        ? { value: row.value } : {}) })),
    command: command && typeof command === 'object' ? { literal: command.literal === true, bytes: count(command.bytes),
      binary: BINS.has(command.binary) || ['other', 'unknown'].includes(command.binary) ? command.binary : 'unknown',
      argumentCount: count(command.argumentCount), flags: Array.isArray(command.flags) ? command.flags.filter(flag => FLAGS.has(flag)).slice(0, FLAGS.size) : [],
      trackedOperands: count(command.trackedOperands), background: command.background === true } : null };
}
