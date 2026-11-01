import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findStep, workflowSteps } from './helpers/workflow-step.mjs';
import { parse } from 'yaml';

const paths = ['_process.yml', '_ship-review.yml', 'release-review.yml'];
const read = name => readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
const source = (text, step) => text.split('\n').slice(step.line - 1, step.last).join('\n');

for (const [index, name] of paths.entries()) {
  test(`#1065 ${name}: native model receives fixed runtime interface and no generic action/MCP publisher`, () => {
    const text = read(name), model = findStep(text, { name: 'Review' }), block = source(text, model);
    assert.match(model.run, /review-native-runner\.mjs"$/);
    assert.doesNotMatch(block, /uses:|allowedTools|mcp__github|github_token/);
    for (const env of ['REVIEW_CLI_PATH', 'REVIEW_POLICY', 'REVIEW_PROMPT', 'REVIEW_JSON_SCHEMA', 'REVIEW_KIND', 'REVIEW_MAX_TURNS', 'REVIEW_EXECUTION_DIR'])
      assert.match(block, new RegExp(env + ':'));
    assert.match(block, new RegExp('REVIEW_MAX_TURNS: ' + (index === 2 ? 200 : 150)));
    const policy = source(text, findStep(text, { name: 'Ограничить инструменты ревью (#1065)' }));
    assert.match(policy, new RegExp('REVIEW_BASE: \\$\\{\\{ needs\\.prepare\\.outputs\\.' + (index === 0 ? 'tools_sha' : 'base') + ' \\}\\}'));
    const prompt = source(text, findStep(text, { name: 'Подготовить native review prompt' }));
    assert.doesNotMatch(prompt, /CLAUDE_CODE_OAUTH_TOKEN:/);
    assert.match(prompt, /mcp__houseplan_review__run_check/);
    assert.match(prompt, /Доступный oracle выполняй/);
    assert.match(prompt, /не заменяй чтением/);
    assert.match(prompt, /review-execution-policy\.json\.checks\.md/);
    if (index === 2) assert.match(prompt, /Не читай ТЗ задач/);
    assert.ok(workflowSteps(text).length > 10, 'entire workflow remains parseable');
    if (index === 0) {
      const schema = JSON.parse(parse(text).jobs.model_review.steps.find(step => step.name === 'Review').env.REVIEW_JSON_SCHEMA);
      const id = new RegExp(schema.properties.outside_findings.items.properties.id.pattern);
      assert.equal(id.test('F1'), true);
      assert.equal(id.test('F234'), true);
      assert.equal(id.test('F0'), false);
      assert.equal(id.test('F12345'), false);
    } else {
      const jobs = parse(text).jobs;
      assert.equal(jobs.model_review.outputs.artifact, '${{ steps.result.outputs.artifact }}');
      const download = jobs.publish.steps.find(step => step.name === 'Получить результат модели');
      assert.equal(download.with.name, '${{ needs.model_review.outputs.artifact }}');
      const gate = jobs.publish.steps.find(step => step.name === 'Проверить исходный producer результата');
      assert.match(gate.run, /review-result-gate\.mjs --batch=(ship|release)/);
      assert.equal(gate.env.REVIEW_PRODUCER_RESULT, '${{ needs.model_review.result }}');
      assert.equal(gate.env.INPUT_MANIFEST, '${{ needs.prepare.outputs.input_manifest }}');
      assert.ok(jobs.publish.steps.indexOf(gate) < jobs.publish.steps.findIndex(step => step.name === 'Опубликовать документ'));
    }
  });
}

test('#1065 publication and retained producer are validated before forwarding', () => {
  const text = read('_process.yml');
  const step = name => findStep(text, { name });
  const gate = step('Проверить полноту и происхождение результата');
  const publish = step('Опубликовать запечатанный вердикт и побочные находки');
  const doc = step('Опубликовать документ ревью');
  const reuse = step('Проверить завершение публикации переиспользуемого ревью');
  const route = step('Решение по вердикту');
  assert.ok(gate.line < publish.line && publish.line < doc.line && doc.line < reuse.line && reuse.line < route.line);
  for (const field of ['RUN_ID', 'ATTEMPT', 'MANIFEST', 'RESULT'])
    assert.match(source(text, gate), new RegExp('REVIEW_PRODUCER_' + field + ':'));
  assert.match(source(text, gate), /REVIEW_VERIFIED_OUTPUT:/);
  assert.match(source(text, publish), /--expected="\$RUNNER_TEMP\/review-verified.json"/);
  assert.match(source(text, publish), /MATERIAL: \$\{\{ needs\.prepare\.outputs\.material_sha \}\}/);
  assert.match(publish.run, /--ref="\$MATERIAL"/);
  assert.match(source(text, doc), /review-publication\.mjs" attach/);
  assert.match(source(text, reuse), /review-publication\.mjs" verify/);
  const pending = step('Не повторять модель для незавершённой публикации');
  assert.ok(pending.line < step('Review').line);
  assert.match(pending.run, /assert-no-pending/);
  assert.match(source(text, pending), /MATERIAL_ISSUE_BODY: \$\{\{ needs\.prepare\.outputs\.material_issue_body \}\}/);
  const seal = source(text, step('Запечатать результат модели'));
  assert.match(seal, /validate-verdict/);
  assert.match(seal, /producer_manifest=/);
  assert.match(text, /name: \$\{\{ needs\.model_review\.outputs\.artifact \}\}/);
  assert.doesNotMatch(source(text, route), /if \[ -n "\$comment" \]; then\n\s+gh issue comment/);
});
