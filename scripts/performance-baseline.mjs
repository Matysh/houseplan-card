// База сравнения «Полных бенчмарков» (#587).
//
// Гейт стабильного релиза требует зелёный прогон `performance.yml` на ТОЧНОМ
// SHA кандидата, а запускается этот workflow только на push в `main`. Из двух
// условий вместе следует порядок, в котором относительное сравнение теряет
// смысл:
//
//   1. кандидат уезжает в `main` → прогон сравнивает линейку с прошлой вершиной
//      `main`, то есть с прошлым стабильным состоянием, и честно краснеет;
//   2. красный гейт чинят следующим коммитом — и он уезжает в ту же `main`;
//   3. базой этого второго прогона становится ПЕРВЫЙ коммит линейки, то есть
//      она сама. Сравнение «сам с собой» зелёное всегда.
//
// Так вышло на выпуске v1.76.0 16.09.2026: прогон 35097102695 показал на
// скрытой изометрии resizePreview 603 → 981 мс и panZoom 91 → 205 мс, а
// следующий прогон — на коммите с принятыми бюджетами — был бы зелёным и без
// правки бюджетов: его базой стал предыдущий кандидат.
//
// Лечится выбором базы, а не порогами: кандидат СТАБИЛЬНОГО релиза (head-коммит
// несёт трейлер `Release:` без пре-релизного суффикса) сравнивается с
// предыдущим стабильным тегом. Тогда каждый коммит линейки судится об одну и ту
// же точку — ту, от которой пользователь и почувствует разницу.
//
// Почему решение живёт здесь, а не в shell шага. Отрицательные случаи этой
// логики — «тега нет», «база не предок», «тег стоит на самой голове» — в YAML
// нельзя прогнать ни одним тестом: шаг исполняется только внутри прогона. Тот
// же довод уже перенёс в `scripts/` разбор вердикта ревью (#556) и
// классификацию изменений (#473). Обращения к git инжектируются, поэтому
// фикстуры описывают дерево, а не подменяют бинарник.

import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';

/** Трейлер `Release: vX.Y.Z[-pre]` в сообщении коммита; иначе `null`. */
export function releaseTrailerTag(message) {
  const match = /^Release:\s*(v?\d+\.\d+\.\d+\S*)\s*$/m.exec(String(message || ''));
  return match ? match[1] : null;
}

/** Стабильный тег — без пре-релизного суффикса: `v1.76.0`, но не `v1.76.0-beta.5`. */
export function isStableTag(tag) {
  return /^v?\d+\.\d+\.\d+$/.test(String(tag || ''));
}

/**
 * Чего просит событие. Разрешение в SHA — отдельным шагом: запрос описывает
 * НАМЕРЕНИЕ, и именно его проверяют фикстуры.
 */
export function requestedComparison({ eventName, manualBase, pushBefore, headMessage } = {}) {
  if (eventName === 'workflow_dispatch' && manualBase) {
    return { kind: 'manual', ref: manualBase, source: `manual comparison ref ${manualBase}` };
  }
  const candidateTag = releaseTrailerTag(headMessage);
  if (candidateTag && isStableTag(candidateTag)) {
    // #587: не «прошлый коммит», а прошлый стабильный релиз. Иначе второй
    // коммит линейки сравнивается с первым и покраснеть не может.
    return {
      kind: 'previous-stable',
      candidateTag,
      source: `previous stable tag (stable candidate ${candidateTag})`,
    };
  }
  if (eventName === 'push' && pushBefore && !/^0+$/.test(String(pushBefore))) {
    return { kind: 'push-before', ref: pushBefore, source: 'push before' };
  }
  return { kind: 'parent', ref: 'HEAD^', source: 'candidate parent' };
}

/**
 * Предыдущий стабильный тег: самый новый `vX.Y.Z`, слитый в HEAD, который
 * стоит не на самой голове и не является тегом самого кандидата.
 *
 * Тег кандидата исключается отдельно от проверки «не голова»: при ремонте уже
 * выпущенного релиза тег на голове уже стоит, и без этого условия база уехала
 * бы на него же.
 */
export function previousStableTag(tags, { headSha, candidateTag } = {}) {
  const wanted = String(candidateTag || '').replace(/^v/, '');
  for (const entry of tags || []) {
    if (!entry || !isStableTag(entry.tag) || !entry.sha) continue;
    if (wanted && String(entry.tag).replace(/^v/, '') === wanted) continue;
    if (headSha && entry.sha === headSha) continue;
    return entry;
  }
  return null;
}

/**
 * Полное разрешение базы. `git` — набор обращений к дереву; чистая логика
 * остаётся выше, а здесь описан порядок отказов.
 *
 * Отказы ведут в сторону БОЛЬШЕГО объёма сравнения, а не меньшего: недоступная
 * база превращается в родителя, отсутствующий родитель — в последний
 * достижимый релизный тег. Молча пропустить сравнение нельзя.
 */
export function resolveComparisonBase({
  eventName, manualBase, pushBefore, headMessage, git,
}) {
  const request = requestedComparison({ eventName, manualBase, pushBefore, headMessage });
  const headSha = git.revParse('HEAD');
  const warnings = [];
  let sha = null;
  let source = request.source;

  if (request.kind === 'previous-stable') {
    const previous = previousStableTag(git.stableTags(), {
      headSha, candidateTag: request.candidateTag,
    });
    if (previous) {
      sha = previous.sha;
      source = `previous stable tag ${previous.tag} (stable candidate ${request.candidateTag})`;
    } else {
      warnings.push(`No stable tag before ${request.candidateTag} is reachable from HEAD; `
        + 'using the candidate parent.');
      sha = git.revParse('HEAD^');
      source = 'candidate parent (no previous stable tag)';
    }
  } else {
    sha = request.kind === 'parent' ? git.revParse('HEAD^') : git.revParse(request.ref);
  }

  const requested = sha;
  let unusable = '';
  if (!sha || !git.exists(sha)) {
    unusable = 'commit is not present after fetching all remote refs';
  } else if (request.kind === 'push-before' && !git.isAncestor(sha, 'HEAD')) {
    unusable = 'commit is no longer an ancestor of the pushed revision';
  }

  if (unusable) {
    const parent = git.revParse('HEAD^');
    if (parent && parent !== headSha) {
      warnings.push(`Comparison SHA ${requested || 'none'} is unusable (${unusable}); `
        + `using candidate parent ${parent}.`);
      sha = parent;
      source = 'candidate parent (unusable requested-base fallback)';
      unusable = '';
    }
  }

  if (unusable) {
    const fallback = previousStableTag(git.stableTags(), { headSha });
    if (!fallback) {
      throw new Error('No usable comparison commit or previous release tag is reachable from HEAD.');
    }
    warnings.push(`Using ${fallback.tag} (${fallback.sha}) as the comparison base.`);
    sha = fallback.sha;
    source = `release tag ${fallback.tag}`;
  }

  // HP-PERF-01: до появления demo/bundle-freshness.mjs деревья несравнимы.
  if (!git.hasPath(sha, 'demo/bundle-freshness.mjs')) {
    warnings.push(`Comparison ${sha} predates HP-PERF-01; using candidate parent HEAD^.`);
    sha = git.revParse('HEAD^');
    source = 'candidate parent (HP-PERF-01 compatibility)';
  }

  return { sha, source, warnings };
}

/** Обращения к настоящему git; вынесены, чтобы фикстуры описывали дерево. */
export function gitAccessors(cwd = process.cwd()) {
  const text = (args) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };
  const ok = (args) => {
    try {
      execFileSync('git', args, { cwd, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  return {
    revParse: (ref) => text(['rev-parse', `${ref}^{commit}`]) || null,
    exists: (sha) => ok(['cat-file', '-e', `${sha}^{commit}`]),
    isAncestor: (sha, ref) => ok(['merge-base', '--is-ancestor', sha, ref]),
    hasPath: (sha, path) => ok(['cat-file', '-e', `${sha}:${path}`]),
    stableTags: () => text(['tag', '--merged', 'HEAD', '--sort=-version:refname'])
      .split('\n')
      .map((tag) => tag.trim())
      .filter((tag) => isStableTag(tag))
      .map((tag) => ({ tag, sha: text(['rev-list', '-n', '1', tag]) }))
      .filter((entry) => !!entry.sha),
  };
}

if (isMainModule(import.meta.url)) {
  const { sha, source, warnings } = resolveComparisonBase({
    eventName: process.env.EVENT_NAME,
    manualBase: process.env.MANUAL_BASE,
    pushBefore: process.env.PUSH_BEFORE_SHA,
    headMessage: process.env.HEAD_MESSAGE,
    git: gitAccessors(process.cwd()),
  });
  for (const warning of warnings) process.stdout.write(`::warning::${warning}\n`);
  process.stdout.write(`Comparison base: ${sha} (${source})\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\nsource=${source}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Comparison base: ${sha} (${source})\n`);
  }
}
