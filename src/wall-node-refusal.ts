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
