import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BETA_E2E } from '../catalog/selections.mjs';
import { CONVERTER_CASES } from '../converters/cases.mjs';
import { chooseE2ETests, listedTests, makeE2ESteps, reserveLoopbackPort, runE2E, testListText, verifyE2ESelection } from '../lib/e2e.mjs';

const project = t => t.suite === 'upgrade' ? 'upgrade' : t.suite === 'first-run'
  ? `first-run-${t.file.includes('.viewer.') ? 'viewer' : 'admin'}` : t.file.includes('.viewer.') ? 'viewer' : t.file.includes('.mobile.') ? 'mobile' : 'admin';
const cases = suite => BETA_E2E.filter(t => t.suite === suite).map(t => ({ ...t, project: project(t), titlePath: [t.title] }));
const report = (items, status) => ({ suites: items.map(t => ({ title: t.file, file: t.file, specs: [{ title: t.title, file: t.file,
  tests: [{ projectName: t.project, status: status === 'passed' ? 'expected' : undefined, results: status ? [{ status }] : [] }] }] })) });
function put(file, content = '') { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, content); }
function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'hp-e2e-adapter-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const e2eRoot = path.join(root, 'source'), workRoot = path.join(root, 'labs');
  for (const file of ['scripts/prepare-seed.mjs', 'scripts/install-houseplan.mjs', 'scripts/ha.mjs', 'node_modules/playwright/cli.js',
    'seed/.storage/core.config_entries', 'contract/data-hp-contract.json', 'tests/fixture.spec.mjs']) put(path.join(e2eRoot, file));
  put(path.join(e2eRoot, 'playwright.config.mjs'), `export default {testDir:'./tests',projects:[{name:'setup'}, {name:'plan-model',dependencies:['setup']}, ...['admin','viewer','mobile','upgrade','first-run-viewer','first-run-admin'].map(name=>({name,dependencies:name==='first-run-admin'?['setup','first-run-viewer']:['setup']}))]};`);
  put(path.join(e2eRoot, 'package.json'), '{"type":"module"}');
  const opts = { e2eRoot, workRoot, targetRef: 'v1.83.1', expectedVersion: '1.83.1', upgradeFrom: 'v1.82.0', haVersion: '2026.10.4', suite: 'journeys' };
  return { root, e2eRoot, workRoot, opts };
}

test('13 accepted cases are selected by file/title; unrelated cross matches never enter', () => {
  let count = 0;
  for (const suite of ['journeys', 'first-run', 'upgrade']) {
    const expected = cases(suite);
    const other = { ...expected[0], file: 'tests/unrelated.admin.spec.mjs' };
    const selected = chooseE2ETests([...expected, other], { suite });
    count += selected.length;
    assert.deepEqual(selected, expected);
    assert.deepEqual(chooseE2ETests([...expected, other], { suite, selection: 'remainder' }), [other]);
    assert.throws(() => chooseE2ETests(expected.slice(1), { suite }), /exactly one/);
    assert.throws(() => verifyE2ESelection([...expected, other], expected), /extra/);
  }
  assert.equal(count, 13);
});

test('Playwright list retains nested title/project identity and rejects discovery errors', () => {
  const input = { suites: [{ title: 'panel.admin.spec.mjs', file: 'panel.admin.spec.mjs', suites: [{ title: 'nested', file: 'panel.admin.spec.mjs', specs: [{ title: 'the case', file: 'panel.admin.spec.mjs', tests: [{ projectName: 'admin' }] }] }] }] };
  const [row] = listedTests(input);
  assert.deepEqual(row.titlePath, ['nested', 'the case']);
  assert.equal(testListText([row]), '[admin] › panel.admin.spec.mjs › nested › the case\n');
  assert.throws(() => listedTests({ errors: [{ message: 'module missing' }] }), /load errors/);
});

test('plan has exact prerequisites and no broad-suite fallback', () => {
  const missing = makeE2ESteps({});
  assert.ok(missing.steps.every(s => s.command === null));
  const complete = makeE2ESteps({ e2eRoot: '/prepared/e2e', candidateRoot: '/candidate', expectedVersion: '1.84.0-beta.1', upgradeFrom: 'v1.83.1', haVersion: '2026.10.4', workRoot: '/private/labs' });
  assert.equal(complete.steps.length, 3);
  assert.ok(complete.steps.every(s => s.command.includes('--execute') && s.command.includes('--candidate-root=/candidate')));
  assert.deepEqual(complete.steps[1].after, [complete.steps[0].id]);
  assert.deepEqual(complete.steps[1].requires, []);
  assert.ok(complete.steps.every(s => !s.allowEmpty));
  assert.ok(makeE2ESteps({ selection: 'remainder' }).steps.every(s => s.allowEmpty));
});

function fakeExecutor(opts, { failure = false, skip = false, extra = false } = {}) {
  const calls = []; let owner, published;
  const selected = opts.suite === 'converters' ? CONVERTER_CASES.map(row => ({ project: 'converters',
    file: 'tests/process-next-converters.spec.mjs', title: row.title, titlePath: [row.title] })) : cases(opts.suite);
  const execute = async (command, context) => {
    calls.push({ command, context });
    const env = context.env;
    if (command.includes('--reporter=json')) {
      const file = env.PLAYWRIGHT_JSON_OUTPUT_FILE;
      put(file, JSON.stringify(report(command.includes('--config=process-next.config.mjs') && extra ? [...selected, { ...selected[0], title: 'unexpected', titlePath: ['unexpected'] }] : selected)));
    } else if (command[1] === 'scripts/install-houseplan.mjs') put(path.join(env.E2E_RUN_DIR, '.e2e-houseplan.json'), JSON.stringify({ version: opts.suite === 'upgrade' ? '1.82.0' : '1.83.1', ref: command.find(s => s.startsWith('--ref=')) }));
    else if (command[0] === 'docker' && command[1] === 'run') { owner = command[command.indexOf('--label') + 1].split('=')[1]; published = command[command.indexOf('-p') + 1].replace(/:8123$/, ''); }
    else if (command[0] === 'docker' && command[1] === 'port') return { code: 0, stdout: published + '\n', stderr: '' };
    else if (command[0] === 'docker' && command[1] === 'inspect') return { code: 0, stdout: owner, stderr: '' };
    else if (command.includes('--reporter=list,json')) {
      put(env.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify(report(selected, skip ? 'skipped' : 'passed')));
      return { code: failure ? 1 : 0, stdout: '', stderr: '' };
    }
    return { code: 0, stdout: '', stderr: '' };
  };
  return { execute, calls };
}

test('converter journeys use three exact cases, own HA and setup only, without changing the companion checkout', async t => {
  const { opts, e2eRoot } = fixture(t);
  opts.suite = 'converters'; opts.selection = 'remainder';
  put(path.join(e2eRoot, 'scripts/users.mjs'), "export const USERS={admin:{storageState:'.auth/admin.json'}};");
  const { execute, calls } = fakeExecutor(opts);
  const before = readdirSync(e2eRoot).sort();
  const result = await runE2E(opts, { execute });
  assert.equal(result.status, 'passed'); assert.equal(result.tests, 3);
  const config = (await import(pathToFileURL(path.join(result.workspace, 'process-next.config.mjs')))).default;
  assert.deepEqual(config.projects.find(project => project.name === 'converters').dependencies, ['setup']);
  assert.ok(!config.projects.some(project => project.name === 'admin' || project.name === 'plan-model'));
  assert.deepEqual(readdirSync(e2eRoot).sort(), before);
  assert.ok(calls.find(call => call.command[1] === 'scripts/prepare-seed.mjs').command.includes('--variant=house'));
});

test('execution owns only its copied seed/container; foreign HA and auth settings are discarded', async t => {
  const { opts, e2eRoot, workRoot } = fixture(t);
  const { execute, calls } = fakeExecutor(opts);
  const before = readdirSync(e2eRoot).sort();
  const result = await runE2E(opts, { execute, environment: { HA_URL: 'http://user-home:8123', HA_CONTAINER: 'user-ha', E2E_RUN_DIR: '/user/config', E2E_ADMIN_PASSWORD: 'private-user-secret' } });
  assert.equal(result.status, 'passed');
  assert.equal(result.tests, 10);
  assert.deepEqual(readdirSync(e2eRoot).sort(), before);
  assert.ok(result.workspace.startsWith(workRoot + path.sep));
  assert.ok(calls.every(c => c.context.cwd === result.workspace));
  assert.ok(calls.every(c => c.context.env.HA_CONTAINER.startsWith('hp-next-')));
  assert.ok(calls.every(c => c.context.env.E2E_ADMIN_PASSWORD !== 'private-user-secret'));
  assert.ok(!calls.some(c => c.command.includes('up') || c.command.includes('down')));
  const run = calls.find(c => c.command.includes('--reporter=list,json'));
  assert.ok(run.command.some(x => x.startsWith('--test-list=')));
  const publish = calls.find(c => c.command[0] === 'docker' && c.command[1] === 'run').command;
  assert.match(publish[publish.indexOf('-p') + 1], /^127\.0\.0\.1:[1-9][0-9]*:8123$/);
  assert.equal(run.context.env.HA_URL, 'http://' + publish[publish.indexOf('-p') + 1].replace(/:8123$/, ''));
  const config = (await import(pathToFileURL(path.join(result.workspace, 'process-next.config.mjs')))).default;
  assert.equal(config.workers, 1);
  assert.ok(config.projects.find(p => p.name === 'admin').grep.test('admin tests/panel.admin.spec.mjs is listed in the sidebar and shows the plan on the very first open'));
  const removes = calls.filter(c => c.command[0] === 'docker' && c.command[1] === 'rm');
  assert.equal(removes.length, 1);
  assert.equal(removes[0].command[3], run.context.env.HA_CONTAINER);
  assert.doesNotMatch(readFileSync(path.join(result.workspace, 'artifacts/summary.json'), 'utf8'), /private-user-secret/);
});

test('extra selected case fails before installing or starting HA', async t => {
  const { opts } = fixture(t);
  const { execute, calls } = fakeExecutor(opts, { extra: true });
  await assert.rejects(runE2E(opts, { execute }), /extra business/);
  assert.ok(calls.every(c => c.command.includes('--list')));
});

test('nonzero process and skipped required journeys cannot be passed; owned container is removed', async t => {
  const { opts } = fixture(t);
  for (const failure of [{ failure: true }, { skip: true }]) {
    const { execute, calls } = fakeExecutor(opts, failure);
    const result = await runE2E(opts, { execute });
    assert.equal(result.status, 'failed');
    assert.ok(calls.some(c => c.command[0] === 'docker' && c.command[1] === 'rm'));
  }
});

test('empty stable remainder is explicit not-required and never starts a lab', async t => {
  const { opts } = fixture(t);
  opts.suite = 'upgrade'; opts.selection = 'remainder';
  const { execute, calls } = fakeExecutor(opts);
  const result = await runE2E(opts, { execute });
  assert.equal(result.status, 'not-required');
  assert.equal(result.tests, 0);
  assert.equal(calls.length, 1);
});

test('cleanup refuses a container whose ownership label does not match this run', async t => {
  const { opts } = fixture(t);
  const fake = fakeExecutor(opts);
  const execute = async (command, context) => command[0] === 'docker' && command[1] === 'inspect'
    ? { code: 0, stdout: 'belongs-to-another-run', stderr: '' } : fake.execute(command, context);
  await assert.rejects(runE2E(opts, { execute }), /ownership could not be confirmed/);
  assert.ok(!fake.calls.some(c => c.command[0] === 'docker' && c.command[1] === 'rm'));
});

test('real Playwright discovery executes exactly selected names with setup dependencies, without browser/HA', async t => {
  const dependencyRoot = fileURLToPath(new URL('../../node_modules', import.meta.url));
  if (!existsSync(path.join(dependencyRoot, 'playwright/cli.js'))) return t.skip('Prepared Playwright dependency is absent');
  const { opts, e2eRoot } = fixture(t);
  rmSync(path.join(e2eRoot, 'node_modules'), { recursive: true });
  symlinkSync(dependencyRoot, path.join(e2eRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const selected = cases('first-run'); opts.suite = 'first-run'; opts.listOnly = true;
  put(path.join(e2eRoot, 'playwright.config.mjs'), `export default {testDir:'./tests',projects:[{name:'setup',testMatch:/auth.setup.mjs/},{name:'first-run-viewer',testDir:'./tests/first-run',testMatch:/viewer.spec.mjs/,dependencies:['setup']},{name:'first-run-admin',testDir:'./tests/first-run',testMatch:/admin.spec.mjs/,dependencies:['setup','first-run-viewer']}]};`);
  put(path.join(e2eRoot, 'tests/auth.setup.mjs'), `import {test} from 'playwright/test';test('login admin',()=>{});test('login viewer',()=>{});`);
  for (const row of selected) put(path.join(e2eRoot, row.file), `import {test} from 'playwright/test';test(${JSON.stringify(row.title)},()=>{});test('extra case must stay out',()=>{});`);
  const result = await runE2E(opts);
  assert.equal(result.status, 'listed');
  assert.equal(result.tests, 2);
  const actual = listedTests(JSON.parse(readFileSync(path.join(result.workspace, 'artifacts/selected.json'), 'utf8')));
  assert.equal(actual.filter(t => t.project === 'setup').length, 2);
  assert.equal(actual.filter(t => t.project !== 'setup').length, 2);
});


test('loopback reservation releases its socket before Docker publishes the explicit port', async t => {
  const { createServer } = await import('node:net');
  const port = await reserveLoopbackPort();
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(port, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve())));
});

test('fixed loopback origin reaches readiness, Playwright and final endpoint evidence unchanged', async t => {
  const { opts } = fixture(t), fake = fakeExecutor(opts);
  const result = await runE2E(opts, { execute: fake.execute, choosePort: async () => 45678 });
  const start = fake.calls.find(c => c.command[0] === 'docker' && c.command[1] === 'run');
  assert.equal(start.command[start.command.indexOf('-p') + 1], '127.0.0.1:45678:8123');
  const ready = fake.calls.find(c => c.command[1] === 'scripts/ha.mjs');
  assert.ok(ready.command.includes('--url=http://127.0.0.1:45678'));
  assert.ok(ready.command.includes('--timeout=480'));
  assert.ok(fake.calls.filter(c => c.command.includes('--reporter=list,json')).every(c => c.context.env.HA_URL === 'http://127.0.0.1:45678'));
  const endpoint = JSON.parse(readFileSync(path.join(result.workspace, 'artifacts/endpoint.json')));
  assert.deepEqual(endpoint, { requestedPort: 45678, initialMapping: '127.0.0.1:45678', finalMapping: '127.0.0.1:45678', finalMappingCode: 0 });
  assert.doesNotMatch(JSON.stringify(endpoint), /password|token|authorization/i);
});

test('bind collision cleans only the labelled partial container before retrying with another fixed port', async t => {
  const { opts } = fixture(t), fake = fakeExecutor(opts);
  let attempts = 0, selected = 45678;
  const execute = async (command, context) => {
    const result = await fake.execute(command, context);
    if (command[0] === 'docker' && command[1] === 'run' && ++attempts === 1) {
      return { code: 125, stdout: '', stderr: 'Bind for 127.0.0.1:45678 failed: port is already allocated' };
    }
    return result;
  };
  const result = await runE2E(opts, { execute, choosePort: async () => selected++ });
  assert.equal(result.status, 'passed');
  const runs = fake.calls.filter(c => c.command[0] === 'docker' && c.command[1] === 'run');
  assert.deepEqual(runs.map(c => c.command[c.command.indexOf('-p') + 1]), ['127.0.0.1:45678:8123', '127.0.0.1:45679:8123']);
  const names = runs.map(c => c.command[c.command.indexOf('--name') + 1]);
  assert.equal(names[0], names[1]);
  const removes = fake.calls.filter(c => c.command[0] === 'docker' && c.command[1] === 'rm');
  assert.deepEqual(removes.map(c => c.command[3]), names);
  assert.ok(fake.calls.indexOf(removes[0]) < fake.calls.indexOf(runs[1]));
  assert.equal(JSON.parse(readFileSync(path.join(result.workspace, 'artifacts/endpoint.json'))).finalMapping, '127.0.0.1:45679');
});

test('three bind collisions stop after three owned cleanups, without a fourth run', async t => {
  const { opts } = fixture(t), fake = fakeExecutor(opts);
  let choices = 0;
  const execute = async (command, context) => {
    const result = await fake.execute(command, context);
    return command[0] === 'docker' && command[1] === 'run'
      ? { code: 125, stdout: '', stderr: 'failed to bind host port: address already in use' } : result;
  };
  await assert.rejects(runE2E(opts, { execute, choosePort: async () => 45678 + choices++ }), /collision after 3 attempts/);
  assert.equal(choices, 3);
  assert.equal(fake.calls.filter(c => c.command[1] === 'run').length, 3);
  assert.equal(fake.calls.filter(c => c.command[1] === 'rm').length, 3);
});

test('non-bind launch errors are not retried and still remove a partial owned container', async t => {
  for (const stderr of ['pull access denied', 'registry failure: address already in use']) {
    const { opts } = fixture(t), fake = fakeExecutor(opts);
    const execute = async (command, context) => {
      const result = await fake.execute(command, context);
      return command[0] === 'docker' && command[1] === 'run' ? { code: 125, stdout: '', stderr } : result;
    };
    await assert.rejects(runE2E(opts, { execute, choosePort: async () => 45678 }), /Docker start failed/);
    assert.equal(fake.calls.filter(c => c.command[1] === 'run').length, 1);
    assert.equal(fake.calls.filter(c => c.command[1] === 'rm').length, 1);
  }
});

test('failed bind launch refuses foreign/unknown ownership and failed cleanup instead of retrying', async t => {
  for (const condition of ['foreign', 'inspect-error', 'rm-error']) {
    const { opts } = fixture(t), fake = fakeExecutor(opts);
    const execute = async (command, context) => {
      const result = await fake.execute(command, context);
      if (command[0] !== 'docker') return result;
      if (command[1] === 'run') return { code: 125, stdout: '', stderr: 'port is already allocated' };
      if (command[1] === 'inspect' && condition === 'foreign') return { code: 0, stdout: 'another-owner', stderr: '' };
      if (command[1] === 'inspect' && condition === 'inspect-error') return { code: 1, stdout: '', stderr: 'daemon unavailable' };
      if (command[1] === 'rm' && condition === 'rm-error') return { code: 1, stdout: '', stderr: 'daemon unavailable' };
      return result;
    };
    await assert.rejects(runE2E(opts, { execute, choosePort: async () => 45678 }), /ownership could not be confirmed|Could not remove owned/);
    assert.equal(fake.calls.filter(c => c.command[1] === 'run').length, 1);
    assert.equal(fake.calls.filter(c => c.command[1] === 'rm').length, condition === 'rm-error' ? 1 : 0);
  }
});

test('invalid/anonymous ports never start Docker and a wrong initial mapping fails before readiness', async t => {
  for (const port of [0, -1, 65536, '45678', NaN]) {
    const { opts } = fixture(t), fake = fakeExecutor(opts);
    await assert.rejects(runE2E(opts, { execute: fake.execute, choosePort: async () => port }), /Invalid explicit loopback port/);
    assert.ok(!fake.calls.some(c => c.command[0] === 'docker'));
  }
  const { opts } = fixture(t), fake = fakeExecutor(opts);
  const execute = async (command, context) => {
    const result = await fake.execute(command, context);
    return command[0] === 'docker' && command[1] === 'port' ? { code: 0, stdout: '127.0.0.1:45679', stderr: '' } : result;
  };
  await assert.rejects(runE2E(opts, { execute, choosePort: async () => 45678 }), /mapping differs/);
  assert.ok(!fake.calls.some(c => c.command[1] === 'scripts/ha.mjs'));
  assert.equal(fake.calls.filter(c => c.command[1] === 'rm').length, 1);
});

test('bind failure with no remaining container retries without deleting any unrelated name', async t => {
  const { opts } = fixture(t), fake = fakeExecutor(opts);
  let attempts = 0, inspections = 0, port = 45678;
  const execute = async (command, context) => {
    const result = await fake.execute(command, context);
    if (command[0] === 'docker' && command[1] === 'run' && ++attempts === 1) return { code: 125, stdout: '', stderr: 'port is already allocated' };
    if (command[0] === 'docker' && command[1] === 'inspect' && ++inspections === 1) return { code: 1, stdout: '', stderr: 'Error: No such object: owned-lab' };
    return result;
  };
  const result = await runE2E(opts, { execute, choosePort: async () => port++ });
  assert.equal(result.status, 'passed');
  assert.equal(attempts, 2);
  assert.equal(fake.calls.filter(c => c.command[1] === 'rm').length, 1);
});

test('an evidence collection exception still removes the already-verified owned container', async t => {
  const { opts } = fixture(t), fake = fakeExecutor(opts);
  const execute = async (command, context) => {
    const result = await fake.execute(command, context);
    if (command[0] === 'docker' && command[1] === 'logs') throw Error('log transport failed');
    return result;
  };
  await assert.rejects(runE2E(opts, { execute, choosePort: async () => 45678 }), /log transport failed/);
  assert.equal(fake.calls.filter(c => c.command[1] === 'rm').length, 1);
});
