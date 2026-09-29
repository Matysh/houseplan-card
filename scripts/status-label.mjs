#!/usr/bin/env node
/**
 * Перестановка статусной метки после интеграции ревью (#706).
 *
 *   node scripts/status-label.mjs --repo=owner/name --issue=NN --from=<метка> --to=<метка>
 *
 * Обычный исход — одна правка: `--add-label TO --remove-label FROM`. Исход
 * `rereview` (#492) возвращает задачу в ту же метку, из которой она пришла:
 * `TO == FROM == S7-code-review`. Одним вызовом `gh` такую метку добавляет и
 * тут же снимает — задача оставалась без статуса, и нового захода не было
 * (#699, 2026-09-28). Поэтому одинаковая метка снимается и ставится заново
 * двумя вызовами, как в автосверке (`relabel`, #555): событие `labeled`
 * запускает новый заход ревью, а сбой повторной постановки роняет шаг, и
 * конвейер зовёт владельца.
 */
import { spawnSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';
import { relabel } from './process-reconcile.mjs';

function gh(args, { allowFailure = false } = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(`gh ${args.join(' ')} → ${(result.stderr || result.error?.message || '').trim()}`);
  }
  return result;
}

/** @returns {'moved' | 'relabeled'} */
export function moveStatusLabel({ repo, issue, from = '', to, execute = gh }) {
  if (!repo || !issue || !to) throw new Error('usage: status-label.mjs --repo=owner/name --issue=NN --from=<метка> --to=<метка>');
  if (from === to) {
    relabel(repo, { number: issue }, to, execute);
    return 'relabeled';
  }
  const args = ['issue', 'edit', String(issue), '--repo', repo, '--add-label', to];
  if (from) args.push('--remove-label', from);
  execute(args);
  return 'moved';
}

if (isMainModule(import.meta.url)) {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';
  try {
    const how = moveStatusLabel({ repo: arg('repo'), issue: arg('issue'), from: arg('from'), to: arg('to') });
    console.log(`${arg('from') || '(без метки)'} -> ${arg('to')}${how === 'relabeled' ? ' (снята и поставлена заново — новый заход, #706)' : ''}`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
