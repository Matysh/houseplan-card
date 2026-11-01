import { createHash } from 'node:crypto';
import { telegramPayload } from '../../scripts/telegram-release.mjs';

/** Release transport only. The caller stores this small receipt in existing release state.
 * A disconnected POST may already have sent a message: never blindly resend it.
 */
export async function announceStableRelease({ candidate, userChangelog, chat, token,
  receipt = candidate?.announcement, persist, fetchImpl = globalThis.fetch,
  timeoutMs = 15_000, retryAmbiguous = false, now = () => new Date().toISOString() }) {
  if (candidate?.kind === 'beta') return { status: 'not-required', reason: 'Prereleases are silent in Telegram' };
  if (!['stable', 'hotfix'].includes(candidate?.kind) || candidate.status !== 'published'
    || !/^v\d+\.\d+\.\d+$/.test(candidate.tag ?? '')) throw Error('Announce a published stable release only');
  if (typeof persist !== 'function') throw Error('Persist the announcement receipt in release state');
  const contentDigest = createHash('sha256').update(`${candidate.tag}\0${userChangelog ?? ''}`).digest('hex');
  if (receipt?.status === 'sent' && !chat) {
    // A local finisher may not possess the hosted Telegram secrets. Delivery
    // was already confirmed; only matching immutable release text is reused.
    if (receipt.tag !== candidate.tag || receipt.contentDigest && receipt.contentDigest !== contentDigest)
      throw Error('Saved announcement belongs to different release text');
    return { ...receipt, reused: true };
  }
  const payload = telegramPayload({ userChangelog, tag: candidate.tag, chat });
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  if (receipt && (receipt.tag !== candidate.tag || receipt.digest !== digest)) throw Error('Saved announcement belongs to different text or destination');
  if (receipt?.status === 'sent') return { ...receipt, reused: true };
  if (['sending', 'uncertain'].includes(receipt?.status) && !retryAmbiguous)
    return { ...receipt, status: 'uncertain', reason: 'Telegram may already have accepted the message; inspect before explicitly retrying' };
  if (typeof token !== 'string' || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw Error('Explicit Telegram bot token required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw Error('Telegram timeout must be within 1–60000 ms');
  const attempt = { tag: candidate.tag, digest, contentDigest, attempt: (receipt?.attempt ?? 0) + 1, status: 'sending', startedAt: now() };
  await persist(attempt);
  let response, result;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs),
    });
    result = await response.json();
  } catch {
    // Do not echo a fetch error: its URL can contain the bot token.
    const uncertain = { ...attempt, status: 'uncertain', reason: 'Telegram response was not received', finishedAt: now() };
    await persist(uncertain); return uncertain;
  }
  if (!response.ok || result?.ok !== true) {
    // A structured Telegram rejection confirms that this attempt did not deliver.
    const failed = { ...attempt, status: result?.ok === false ? 'failed' : 'uncertain',
      reason: `Telegram refused or did not confirm delivery (HTTP ${Number(response.status) || 0})`, finishedAt: now() };
    await persist(failed); return failed;
  }
  if (!Number.isSafeInteger(result.result?.message_id)) {
    const uncertain = { ...attempt, status: 'uncertain', reason: 'Telegram success omitted its message identity', finishedAt: now() };
    await persist(uncertain); return uncertain;
  }
  const sent = { ...attempt, status: 'sent', messageId: result.result.message_id, finishedAt: now() };
  // If this write fails, the durable 'sending' receipt prevents a duplicate POST.
  await persist(sent); return sent;
}
