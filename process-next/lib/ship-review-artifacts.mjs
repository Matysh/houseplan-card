import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sha256 } from './github.mjs';
import { within } from './storage.mjs';

const verdictText = verdict => ({ accepted: 'принято; блокирующих замечаний нет',
  changes_requested: 'нужны исправления; публикация беты остановлена',
  incomplete: 'анализ не завершён; публикация беты ожидает результат',
  'not-required': 'новое ревью не требуется: нет непроверенных ship-задач' })[verdict] ?? 'результат ещё не получен';

function reportSection(record, label) {
  const { packet, result } = record;
  const lines = [`<details>`, `<summary>${label}</summary>`, '',
    `Запрос: \`${packet.requestId}\`. Кандидат: \`${packet.candidateId}\`.`,
    `Диапазон: \`${packet.base ?? 'начало истории'}\` → \`${packet.head}\`.`,
    `Задачи этого анализа: ${packet.pending.map(issue => `#${issue}`).join(', ') || 'нет'}.`, '',
    `Результат: **${verdictText(result?.verdict)}**.`, ''];
  if (result?.markdown) lines.push(result.markdown);
  else if (result?.report) lines.push('```json', JSON.stringify(result.report, null, 2), '```');
  lines.push('', '</details>');
  return lines.join('\n');
}

/** Release assets retain full reports even after the workflow artifact expires. */
export function prepareShipReviewArtifacts({ root, candidate, records = {} }) {
  if (!candidate.shipReview) return [];
  const pointer = candidate.shipReview, current = records[pointer.requestId];
  if (!current?.packet || current.packet.requestId !== pointer.requestId
    || current.packet.head !== pointer.sha || current.packet.selectionDigest !== pointer.selectionDigest)
    throw Error('Ship review receipt is unavailable for this candidate reference');
  const reused = [];
  for (const reference of current.packet.reused) {
    const record = records[reference.requestId];
    if (record?.result?.verdict !== 'accepted' || !record.packet?.pending?.includes(reference.issue)
      || !record.packet.tasks?.some(task => task.issue === reference.issue && task.fingerprint === reference.fingerprint))
      throw Error(`Accepted ship review receipt is unavailable for #${reference.issue}`);
    let entry = reused.find(row => row.packet.requestId === reference.requestId);
    if (!entry) { entry = { references: [], ...structuredClone(record) }; reused.push(entry); }
    entry.references.push(structuredClone(reference));
  }
  const data = { schema: 1, candidate: { id: candidate.id, kind: candidate.kind,
    sha: candidate.sha, sourceSha: candidate.sourceSha, tag: candidate.tag ?? null },
    shipReview: structuredClone(pointer), current: structuredClone(current), reused };
  const lines = ['# Пакетное код-ревью ship-задач', '',
    `Выпуск: **${candidate.tag ?? candidate.id}**. Кандидат выпуска: \`${candidate.sha}\`.`,
    `Исходный SHA выпуска: \`${candidate.sourceSha}\`. Проверенный кандидат беты: \`${current.packet.head}\`.`,
    `Результат: **${verdictText(current.result?.verdict)}**.`,
    `В выборке: ${current.packet.tasks.length}; передано на анализ: ${current.packet.pending.length}; засчитано ранее: ${current.packet.reused.length}.`, '',
    ...(current.packet.unclassified?.length ? [`Старые задачи без подтверждённого трека: ${current.packet.unclassified.map(issue => `#${issue}`).join(', ')}. Они не включены в ship-ревью и не считаются проверенными; отсутствие старой метки не блокирует бету.`, ''] : []),
    'High останавливает бету; Medium и Low видны в отчёте и не блокируют публикацию. Статусы S8 и назначенные треки не меняются.', '',
    reportSection(current, 'Полный отчёт текущего запроса')];
  for (const record of reused) lines.push('', reportSection(record,
    `Ранее принятое ревью: ${record.references.map(row => `#${row.issue}`).join(', ')}`));
  root = resolve(root);
  const output = within(root, join(root, 'artifacts/process-next/publication'));
  mkdirSync(output, { recursive: true });
  return [['SHIP-REVIEW.json', JSON.stringify(data, null, 2) + '\n'], ['SHIP-REVIEW.md', lines.join('\n') + '\n']]
    .map(([name, text]) => {
      const path = within(root, join(output, name)); writeFileSync(path, text);
      return { name, path, expectedDigest: sha256(readFileSync(path)) };
    });
}
