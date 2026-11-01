// #1014: advisory Git measurements, never a gate or a proof of equivalence.
import { parseNumstat } from './process-track.mjs';
import { parseHandoff } from './review-handoff.mjs';
import { committedBundleMustMatch, isReleaseMessage } from './bundle-policy.mjs';

export const BETA_DERIVED_SUBJECT = /^docs: accept derived artifacts on dev for v\d/;
// #752: Release alone is not a promotion; retain task artifact-acceptance commits.
export function isBetaCommit(commit) {
  const body = String(commit?.body ?? '');
  const subject = body.split('\n', 1)[0];
  return BETA_DERIVED_SUBJECT.test(subject) || isReleaseMessage(body)
    && committedBundleMustMatch({ subject, files: (commit?.files || []).map(file => file.path) });
}

export const REPLACEMENT_GROWTH_RATIO = 3;
const replacementTypes = new Set(['fix', 'refactor', 'chore']);
export const sourceCommitType = body => /^([a-z]+)(?:\([^\n]*\))?!?:/u.exec(String(body).split('\n')[0])?.[1] || 'other';

/** Shared parser for the Git numstat recipe used by packet and metrics. */
export function parseSourceCommitLog(text = '') {
  return String(text).split('\x1e').filter(record => record.trim()).map(record => {
    const [sha, date, body = '', numstat = ''] = record.split('\x1f');
    return { sha: sha.trim(), date: date?.trim() || null, body, files: parseNumstat(numstat) };
  }).filter(commit => /^[0-9a-f]{7,64}$/u.test(commit.sha));
}

export function sourceChurn(commit) {
  const input = commit?.sourceFiles || commit?.files;
  const files = Array.isArray(input) ? input : [];
  const source = files.filter(file => typeof file?.path === 'string'
    && file.path.startsWith('src/') && !file.path.startsWith('src/i18n/')
    && Number.isSafeInteger(file.added) && file.added >= 0
    && Number.isSafeInteger(file.deleted) && file.deleted >= 0);
  return { files: source.length, added: source.reduce((n, f) => n + f.added, 0),
    deleted: source.reduce((n, f) => n + f.deleted, 0) };
}

export function sourceReplacementWarnings(commits = [], handoff = '') {
  const parsed = parseHandoff(handoff);
  if (parsed.candidate && /оставлен старый путь\s*:/iu.test(parsed.text)) return [];
  return (Array.isArray(commits) ? commits : []).flatMap(commit => {
    const type = sourceCommitType(commit.message ?? commit.body);
    const { added, deleted } = sourceChurn(commit);
    if (!replacementTypes.has(type) || added <= REPLACEMENT_GROWTH_RATIO * deleted) return [];
    return [`${commit.sha?.slice(0, 12) || type}: src +${added}/−${deleted} (> ${REPLACEMENT_GROWTH_RATIO}×). `
      + 'Проверьте удаление заменённого пути; если он нужен, укажите в «НЕ сделано»: '
      + '«оставлен старый путь: файл:символ — причина — задача на удаление #…». '
      + 'Это подсказка по объёму, а не доказательство дублирования или запрет.'];
  });
}

export function sourceGrowthMetrics(commits = []) {
  const byType = new Map();
  for (const commit of Array.isArray(commits) ? commits : []) {
    const churn = sourceChurn(commit);
    if (!churn.files) continue;
    const type = sourceCommitType(commit.body ?? commit.message);
    const row = byType.get(type) || { type, commits: 0, reduced: 0, added: 0, deleted: 0 };
    row.commits++;
    row.reduced += Number(churn.deleted > churn.added);
    row.added += churn.added; row.deleted += churn.deleted;
    byType.set(type, row);
  }
  const rows = [...byType.values()].sort((a, b) => a.type.localeCompare(b.type));
  const commitsCount = rows.reduce((n, row) => n + row.commits, 0);
  const reduced = rows.reduce((n, row) => n + row.reduced, 0);
  return { commits: commitsCount, reduced, reducedShare: commitsCount ? reduced / commitsCount : null,
    byType: rows.map(row => ({ ...row, net: row.added - row.deleted })) };
}

export function renderSourceGrowth(metrics, label = 'окно отчёта') {
  const share = metrics.reducedShare === null ? 'нет данных' : `${(100 * metrics.reducedShare).toFixed(1)}%`;
  return ['### Изменение src (#1014)', '', `Диапазон: ${label}. Без i18n, binary и релизных промоушенов. `
    + `Уменьшили src: ${metrics.reduced}/${metrics.commits} (${share}).`, '',
  '| Тип | Коммитов | Уменьшили src | Вставки | Удаления | Net |', '|---|---:|---:|---:|---:|---:|',
  ...metrics.byType.map(row => `| ${row.type} | ${row.commits} | ${row.reduced} | ${row.added} | ${row.deleted} | ${row.net} |`), ''].join('\n');
}
