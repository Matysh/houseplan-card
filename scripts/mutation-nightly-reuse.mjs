#!/usr/bin/env node
// #620: ночной полный реестр не гоняется повторно на том же дереве.
//
// Что было. `mutation-gate.yml` каждую ночь прогонял все 800+ мутантов —
// ≈ 212 job-минут, — даже когда `dev` не менялся: 16–20.09 четыре ночи подряд
// ушли на один SHA. Доказательство прогона content-адресно уже с #549
// (evidence несёт tree), но им никто не пользовался.
//
// Как теперь. Зелёный полный прогон (все шесть шардов доказаны агрегатором)
// оставляет маркер: tree материала, SHA workflow, номер прогона, время. Ночь
// по расписанию читает самый свежий маркер своего tree и workflow и, если он
// действителен, не гоняет шарды — в сводке прогона стоит «reused from run N».
//
// Чего маркер не делает. Он не переносит красный: маркер пишется только после
// зелёного агрегатора, так что ночь после отказа гонит реестр заново и снова
// заводит issue (#472). Ручной dispatch — отладка гейта — всегда гонит полный
// реестр. Маркер старше MAX_REUSE_AGE_DAYS не принимается: tree фиксирует код,
// но не раннер (образ ubuntu, патч Python, кэш Chromium), и раз в неделю реестр
// обязан пройти на свежем окружении даже на неизменном дереве. SHA workflow в
// ключе — по той же причине: другой workflow (делитель шардов, шаги) — другое
// доказательство.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

export const REUSE_MARKER_SCHEMA = 'houseplan-mutation-green/v1';
export const MAX_REUSE_AGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
// Часы раннеров расходятся на секунды; маркер «из будущего» дальше этого — подделка
// или сломанные часы, и принимать его нельзя.
const CLOCK_SKEW_MS = 10 * 60 * 1000;
const FULL_SHA = /^[0-9a-f]{40}$/;
const positiveInteger = (value) => /^[1-9]\d*$/.test(String(value ?? ''));

/** Маркер зелёного полного прогона. Бросает на неполной identity. */
export function reuseMarker(input) {
  const marker = {
    schema: REUSE_MARKER_SCHEMA,
    tree: String(input.tree || ''),
    sha: String(input.sha || ''),
    workflowSha: String(input.workflowSha || ''),
    runId: String(input.runId ?? ''),
    runAttempt: String(input.runAttempt ?? ''),
    event: String(input.event || ''),
    provenAt: new Date(input.now ?? Date.now()).toISOString(),
  };
  if (!FULL_SHA.test(marker.tree) || !FULL_SHA.test(marker.sha) || !FULL_SHA.test(marker.workflowSha)
    || !positiveInteger(marker.runId) || !positiveInteger(marker.runAttempt) || !marker.event) {
    throw new Error('invalid mutation reuse marker identity');
  }
  return marker;
}

/**
 * Чистое решение: можно ли не гонять реестр этой ночью.
 *
 * @param {object} p
 * @param {string} p.event        github.event_name текущего прогона
 * @param {string} p.tree         tree зафиксированного материала
 * @param {string} p.workflowSha  github.workflow_sha текущего прогона
 * @param {object|null} p.marker  восстановленный маркер либо null
 * @param {number} p.now          мс эпохи
 * @param {number} [p.maxAgeDays]
 * @returns {{ reuse: boolean, reason: string, runId?: string }}
 */
export function decideNightlyReuse({ event, tree, workflowSha, marker, now, maxAgeDays = MAX_REUSE_AGE_DAYS }) {
  const no = (reason) => ({ reuse: false, reason });
  if (event !== 'schedule') return no('not a scheduled run — manual dispatch always runs the full registry');
  if (!FULL_SHA.test(String(tree || ''))) return no('material tree is not a full SHA');
  if (!marker || typeof marker !== 'object') return no('no green marker for this tree');
  if (marker.schema !== REUSE_MARKER_SCHEMA) return no('marker schema is unknown');
  if (marker.tree !== tree) return no('marker proves another tree');
  if (!FULL_SHA.test(String(workflowSha || '')) || marker.workflowSha !== workflowSha) {
    return no('marker was proved by another workflow revision');
  }
  if (!positiveInteger(marker.runId)) return no('marker names no run');
  const provenAt = Date.parse(String(marker.provenAt || ''));
  if (!Number.isFinite(provenAt)) return no('marker has no proof time');
  if (provenAt - now > CLOCK_SKEW_MS) return no('marker is dated in the future');
  if (now - provenAt > maxAgeDays * DAY_MS) return no(`marker is older than ${maxAgeDays} days`);
  return { reuse: true, reason: `tree ${tree} already proved green`, runId: String(marker.runId) };
}

function readMarker(file) {
  if (!file || !existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const arg = (argv, name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

export function main(argv, { now = Date.now(), log = (line) => console.log(line), warn = (line) => console.error(line) } = {}) {
  const writeTo = arg(argv, 'write-marker');
  if (writeTo) {
    const marker = reuseMarker({
      tree: arg(argv, 'tree'), sha: arg(argv, 'sha'), workflowSha: arg(argv, 'workflow-sha'),
      runId: arg(argv, 'run-id'), runAttempt: arg(argv, 'run-attempt'), event: arg(argv, 'event'), now,
    });
    mkdirSync(dirname(writeTo), { recursive: true });
    writeFileSync(writeTo, `${JSON.stringify(marker, null, 2)}\n`);
    warn(`маркер зелёного прогона: tree ${marker.tree}, run ${marker.runId}`);
    return 0;
  }
  if (!argv.includes('--decide')) {
    warn('usage: mutation-nightly-reuse.mjs --decide --event= --tree= --workflow-sha= --marker= [--summary=] [--run-url-base=]\n'
      + '       mutation-nightly-reuse.mjs --write-marker=<file> --tree= --sha= --workflow-sha= --run-id= --run-attempt= --event=');
    return 2;
  }
  const decision = decideNightlyReuse({
    event: arg(argv, 'event'), tree: arg(argv, 'tree'), workflowSha: arg(argv, 'workflow-sha'),
    marker: readMarker(arg(argv, 'marker')), now,
  });
  // stdout — только строки key=value для $GITHUB_OUTPUT; человеку — stderr и сводка.
  log(`reuse=${decision.reuse ? 'true' : 'false'}`);
  if (decision.reuse) log(`reused_run=${decision.runId}`);
  warn(decision.reuse ? `reused from run ${decision.runId}: ${decision.reason}` : `full run: ${decision.reason}`);
  const summary = arg(argv, 'summary');
  if (summary) {
    const base = arg(argv, 'run-url-base');
    const link = decision.reuse && base ? ` (${base}/${decision.runId})` : '';
    appendFileSync(summary, decision.reuse
      ? `### Мутационный реестр: reused from run ${decision.runId}${link}\n\n`
        + `Дерево \`${arg(argv, 'tree')}\` уже доказано зелёным полным прогоном; шарды не запускались (#620).\n`
      : `### Мутационный реестр: полный прогон\n\nПовторное использование отклонено: ${decision.reason}.\n`);
  }
  return 0;
}

if (isMainModule(import.meta.url)) process.exit(main(process.argv.slice(2)));
