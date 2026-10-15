import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigWriteContext, configWriteErrorKey } from '../test-build/config-write-context.js';
import { t } from '../test-build/i18n.js';

test('#890 AC6: same HA connection/reconnect keeps drafts; foreign authority fences A→B→A replies', () => {
  const owner = new ConfigWriteContext();
  const a = { connection: {}, callWS() {}, user: { id: 'owner' } };
  assert.equal(owner.observe(a), false);
  const claim = owner.claim();
  assert.equal(owner.observe({ ...a, callWS() {} }), false);
  assert.equal(owner.current(claim, a), true);
  assert.equal(owner.observe(null), false, 'temporary disconnect is not proof of a foreign installation');
  assert.equal(owner.current(claim, null), false);
  assert.equal(owner.owns(claim), true, 'disconnect must still retire its own pending counter');
  assert.equal(owner.observe(a), false);
  assert.equal(owner.current(claim, a), true);
  const b = { ...a, connection: {} };
  assert.equal(owner.observe(b), true);
  assert.equal(owner.current(claim, b), false);
  assert.equal(owner.owns(claim), false, 'late A completion cannot decrement the B counter');
  assert.equal(owner.observe(a), true);
  assert.equal(owner.current(claim, a), false, 'returning identity cannot revive an old generation');
  assert.equal(owner.current(owner.claim(), a), true);
});

test('#890 AC6: user authority and connection-less transport replacements are isolated', () => {
  const owner = new ConfigWriteContext();
  const a = { callWS() {}, user: { id: 'a' } };
  owner.observe(a);
  assert.equal(owner.observe({ ...a, user: { id: 'b' } }), true);
  assert.equal(owner.observe({ ...a, callWS() {} }), true);
});

test('#890 AC5: save unauthorized differs from backup in RU/EN; conflict keeps its existing context', () => {
  for (const language of ['ru', 'en']) {
    const save = t(language, configWriteErrorKey({ code: 'unauthorized' }));
    const backup = t(language, 'backup.error.unauthorized');
    assert.notEqual(save, backup);
    assert.match(save, language === 'ru' ? /сохранение плана/ : /save this plan/);
    assert.doesNotMatch(save, /\[object Object\]|export|экспорт/);
  }
  assert.equal(configWriteErrorKey({ code: 'conflict' }), null);
  assert.equal(configWriteErrorKey('offline'), null);
});

test('#912 saved OFF cache failures explain storage and never claim a successful save', () => {
  for (const language of ['ru', 'en']) {
    const text = t(language, configWriteErrorKey({ code: 'storage_clear' }));
    assert.match(text, /HA/);
    assert.match(text, language === 'ru' ? /Настройки не сохранены/ : /Settings were not saved/);
    assert.notEqual(t(language, configWriteErrorKey({ code: 'storage_read' })), 'backup.error.storage_read');
  }
});

test('#907 known context refusal has a human RU/EN message, while unknown reasons keep their mapper', () => {
  const key = configWriteErrorKey(Object.assign(new Error('config authority changed'), { code: 'context-changed' }));
  assert.equal(key, 'err.config_context_changed');
  for (const language of ['ru', 'en']) {
    const message = t(language, key);
    assert.equal(message, language === 'ru'
      ? 'Контекст Home Assistant изменился. Повторите действие.'
      : 'Home Assistant context changed. Try again.');
    assert.doesNotMatch(message, /context-changed|config authority changed|err\./);
  }
  assert.equal(configWriteErrorKey({ code: 'conflict', message: 'keep conflict' }), null);
  assert.equal(configWriteErrorKey({ code: 'other', message: 'keep vendor detail' }), null);
  assert.equal(configWriteErrorKey(new Error('config authority changed')), null, 'unknown raw messages are not guessed');
});
