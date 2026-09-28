// #697, PROCESS.md §8: отпечаток и кадры скриншотов, эталоны golden —
// одним коммитом бота на dev перед бетой, а не в каждой ветке задачи.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateCommitMessage } from '../scripts/validate-commit-provenance.mjs';
import { isCandidateSubject } from '../scripts/bundle-policy.mjs';

const WORKFLOW = readFileSync(fileURLToPath(new URL('../.github/workflows/beta-derived.yml', import.meta.url)), 'utf8');
const step = (name) => {
  const start = WORKFLOW.indexOf(`      - name: ${name}\n`);
  assert.ok(start > 0, `нет шага ${name}`);
  const next = WORKFLOW.indexOf('\n      - ', start + 10);
  return next < 0 ? WORKFLOW.slice(start) : WORKFLOW.slice(start, next);
};

test('#697 бот: только по кнопке, прав на запись у job нет — пишет PAT одним push', () => {
  assert.match(WORKFLOW, /^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(WORKFLOW, /^\s+(push|schedule|workflow_run):/m);
  assert.match(WORKFLOW, /permissions:\n\s+contents: read\n\s+actions: read\n/);
  assert.doesNotMatch(WORKFLOW, /contents: write/);
  const commit = step('Коммит в dev');
  assert.match(commit, /git push -q "https:\/\/x-access-token:\$TOKEN@github\.com\/\$\{\{ github\.repository \}\}" HEAD:dev/);
  assert.doesNotMatch(commit, /--force/, 'ушедший dev — перезапуск, а не перезапись');
});

test('#697 бот: скриншоты принимаются по канону, изменённый кадр — только объявленный', () => {
  const docs = step('Кадры документации — съёмка и приёмка');
  assert.match(docs, /node demo\/docs\/capture\.mjs --stability=3/);
  assert.match(docs, /git checkout -- docs\/images\n\s+git clean -fdq -- docs\/images/, 'приёмка сравнивает с закоммиченными кадрами');
  assert.match(docs, /args=\(--reviewed "--from=\$cand"\)/);
  assert.match(docs, /--expect-change=\$EXPECT/);
  assert.match(docs, /EXPECT: \$\{\{ inputs\.docs_expect_change \}\}/);
  assert.match(WORKFLOW, /OXIPNG_VERSION: 10\.2\.0/, 'тот же упаковщик, что docs-screenshots.yml');
  const screenshots = readFileSync(fileURLToPath(new URL('../.github/workflows/docs-screenshots.yml', import.meta.url)), 'utf8');
  assert.match(screenshots, /OXIPNG_VERSION: 10\.2\.0/);
});

test('#697 бот: эталоны golden — только из завершённого Validate на dev', () => {
  const golden = step('Эталоны golden из прогона Validate');
  assert.match(golden, /if: inputs\.golden_run != ''/);
  assert.match(golden, /\[ "\$path" != "\.github\/workflows\/validate\.yml" \] \|\| \[ "\$branch" != "dev" \] \|\| \[ "\$status" != "completed" \]/);
  assert.match(golden, /gh run download "\$RUN" --repo "\$\{\{ github\.repository \}\}" -n golden-images/);
  assert.match(golden, /node scripts\/golden-accept\.mjs "\$\{args\[@\]\}"/);
});

test('#697 бот: сообщение коммита проходит провенанс и не выдаёт себя за кандидата', () => {
  const commit = step('Коммит в dev');
  assert.match(commit, /if \[ "\$GOLDEN_CHANGED" = "true" \]; then\n\s+echo "Release: \$TAG"\n\s+echo "Baseline-Reviewed: \$GOLDEN_URL"/,
    'эталоны без Release: и Baseline-Reviewed: провенанс отклонит');
  assert.match(commit, /echo "Issue: #697"\n\s+echo "User-Visible: no"/);
  const subject = 'docs: accept derived artifacts on dev for v1.79.0-beta.1';
  assert.match(commit, /echo "docs: accept derived artifacts on dev for \$TAG"/);
  assert.equal(isCandidateSubject(subject), false, 'бандл кандидата у коммита бота не сверяется');
  const golden = [subject, '', 'Производные артефакты беты.', '',
    'Release: v1.79.0-beta.1', 'Baseline-Reviewed: https://github.com/o/r/actions/runs/1', 'Issue: #697', 'User-Visible: no'].join('\n');
  assert.deepEqual(validateCommitMessage(golden, ['docs/images/screenshots.json', 'demo/golden/baselines/a.png']), []);
  const docsOnly = [subject, '', 'Производные артефакты беты.', '', 'Issue: #697', 'User-Visible: no'].join('\n');
  assert.deepEqual(validateCommitMessage(docsOnly, ['docs/images/screenshots.json']), []);
  assert.notDeepEqual(validateCommitMessage(docsOnly, ['demo/golden/baselines/a.png']), [], 'эталоны без провенанса — отказ');
});
