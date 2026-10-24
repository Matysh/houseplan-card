/** #891: failure taxonomy shared by drag and server-owned node history. */
export type NodeWriteRefusal = 'conflict' | 'incompatible' | 'proof' | 'unavailable';
const PROOF = new Set(['stale-node-snapshot', 'node_move_invalid', 'node_move_opening_blocked',
  'node_move_unsupported_junction', 'invalid_passage_fields', 'invalid_partition_opening_host',
  'invalid_partition_opening_jamb_margin']);
export function nodeWriteRefusal(error: unknown, foreign = false): NodeWriteRefusal {
  const code = String((error as { code?: unknown } | null)?.code ?? (error as Error | null)?.message ?? '');
  if (foreign || code === 'conflict') return 'conflict';
  if (code === 'wall_model_client_outdated' || code === 'wall_model_version_unsupported') return 'incompatible';
  if (PROOF.has(code) || /^junction_limit_(?:angle|valence|length|distance)$/.test(code)) return 'proof';
  // Backend/transport/unknown codes are not evidence that geometry is unfit.
  return 'unavailable';
}
export function nodeDragRefusalKey(error: unknown, foreign = false): string {
  const kind = nodeWriteRefusal(error, foreign);
  return kind === 'conflict' ? 'node_move_write_conflict' : kind === 'incompatible' ? 'node_move_update_required'
    : kind === 'proof' ? 'node_move_invalid' : 'node_move_write_unavailable';
}
/** #1045: deletion never borrows movement wording or removes a refused command. */
export function nodeDeleteRefusalKey(error: unknown, foreign = false): string {
  const code = String((error as { code?: unknown } | null)?.code ?? (error as Error | null)?.message ?? '');
  if (foreign || code === 'conflict' || code === 'stale-node-snapshot' || code === 'superseded-node-response') return 'node_delete_write_conflict';
  if (['unknown_command', 'wall_model_client_outdated', 'wall_model_version_unsupported'].includes(code)) return 'node_delete_update_required';
  if (code === 'node_delete_degree') return 'node_delete_degree';
  if (['node_delete_opening', 'invalid_passage_fields', 'invalid_partition_opening_host', 'invalid_partition_opening_jamb_margin'].includes(code)) return 'node_delete_opening';
  if (code === 'node_delete_unsafe' || /^junction_limit_(?:angle|valence|length|distance)$/.test(code)) return 'node_delete_unsafe';
  return 'node_delete_write_unavailable';
}
