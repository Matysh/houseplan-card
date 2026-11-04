/** Shared CPU-only backend boundary for synthetic room-creation transports. */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./room-write-python.py', import.meta.url));
export function validateOrdinaryRoomWrite(previous, message) {
  const result = JSON.parse(execFileSync(process.env.PYTHON || 'python3', [script], {
    input: JSON.stringify({ previous, message }), encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024, timeout: 30000,
  }));
  if (!result.ok) throw Object.assign(new Error(result.error.message), {
    code: 'invalid_format', validationType: result.error.type,
  });
  return result.config;
}

export function ordinaryRoomWriteReply(previous, message) {
  try { return { ok: true, config: validateOrdinaryRoomWrite(previous, message) }; }
  catch (error) {
    if (!error.validationType) throw error; // a missing/broken Python is not a validation verdict
    return { ok: false, error: { code: error.code, message: error.message, type: error.validationType } };
  }
}
