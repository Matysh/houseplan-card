// UI Lab only: reuse the latest compatible local session across prototype builds.
// No copying or deletion of browser data; ordinary edits keep using its existing key.
import {sessionIdentity, parseSession} from '/session.mjs';
import {readStoredSession} from '/session-storage.mjs';
export async function preserveSession(migration) {
  if(!migration)return;
  const provenance=await fetch('/provenance.json').then(response=>response.json());
  const current=sessionIdentity(provenance);
  if(current.productFingerprint!==migration.to)return;
  for(const fingerprint of [...new Set([current.productFingerprint,migration.from,...(migration.previous||[])])]) {
    if(!fingerprint)continue;
    const identity={...current,productFingerprint:fingerprint};
    const text=await readStoredSession(identity);
    if(text===undefined)continue;
    // Validate the exact entry before selecting it; do not silently reset a broken session.
    if(text!==null)parseSession(text,identity);
    globalThis.__hpLabSessionIdentity=identity;
    return;
  }
}
