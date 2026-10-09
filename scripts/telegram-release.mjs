#!/usr/bin/env node
/** Lossless transport of the author's RU narrative, not a changelog generator. */
import { readFileSync, writeFileSync } from 'node:fs';
import { isMainModule } from './spawn-portable.mjs';
import { narrativeLanguages } from './release-narrative.mjs';

export const TELEGRAM_LIMIT = 4096;
const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function markdownToTelegram(text) {
  let html = '', plain = '', offset = 0;
  for (const match of text.matchAll(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g)) {
    const chunk = text.slice(offset, match.index);
    html += escape(chunk); plain += chunk;
    const url = new URL(match[2]);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password)
      throw new Error('Telegram release links must be credential-free HTTPS GitHub links');
    html += `<a href="${escape(match[2])}">${escape(match[1])}</a>`;
    plain += match[1]; offset = match.index + match[0].length;
  }
  html += escape(text.slice(offset)); plain += text.slice(offset);
  return { html, plain };
}

export function telegramPayload({ notes, tag, url, chat, testMessage = false }) {
  if (!chat) throw new Error('Telegram chat is missing');
  let text;
  if (testMessage) text = '✅ Тест: оповещения о релизах houseplan-card подключены.';
  else {
    if (!/^v\d+\.\d+\.\d+$/.test(tag || '')) throw new Error('Only stable releases may be announced');
    const { ru } = narrativeLanguages(notes, { tag });
    text = `🏠 houseplan-card ${tag}\n\n${ru}\n\n[Релиз](${url})`;
  }
  const { html, plain } = markdownToTelegram(text);
  // UTF-16 is a conservative bound (emoji count as two). Never truncate UTF-8 or links.
  if (plain.length > TELEGRAM_LIMIT) throw new Error(`RU announcement exceeds ${TELEGRAM_LIMIT} characters; agent must shorten prose, not truncate it`);
  return { chat_id: chat, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
}

if (isMainModule(import.meta.url)) {
  try {
    const testMessage = process.env.EVENT === 'workflow_dispatch' && process.env.CALLED !== 'true';
    const payload = telegramPayload({
      notes: testMessage ? '' : readFileSync('docs/RELEASE-NOTES.md', 'utf8'),
      tag: process.env.INPUT_TAG, url: process.env.INPUT_URL, chat: process.env.CHAT, testMessage,
    });
    writeFileSync(process.argv[2] || 'telegram-request.json', `${JSON.stringify(payload)}\n`);
  } catch (error) { console.error(`Telegram release: ${error.message}`); process.exitCode = 1; }
}
