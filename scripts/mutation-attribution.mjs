// Атрибуция отказа подготовки свидетеля (#568).
//
// Модуль отдельный не ради красоты: чтение реестра базы живёт в
// `mutation-selection.mjs`, запуск мутанта — в `mutation-execution.mjs`, а
// границу между ними держит тест #558 — запуск не имеет права зависеть от
// отбора. Композиция двух механик — это третье место, и вот оно.
import { runMutant } from './mutation-execution.mjs';
import { setupFailureOwner } from './mutation-guard-outcome.mjs';
import { baseRegistry } from './mutation-selection.mjs';
/**
 * Кому принадлежит отказ подготовки (#568).
 *
 * Сравнивается ПОДОБНОЕ С ПОДОБНЫМ: определение мутанта из базы диапазона на
 * дереве базы. Первая версия брала определение из головы — и собственная
 * сломанная правка реестра выглядела «предсуществующей»: такое определение не
 * компилируется и на базе тоже. Мутанта, которого в базе нет, оправдывать нечем
 * по построению. `null` — сказать нечего: базы нет, реестр базы не прочитан или
 * прогон сорвался; тогда отказ остаётся отказом этой задачи.
 */
export async function attributeSetupFailure(mutant, outcome, rangeBase, {
  registryOf = baseRegistry,
  run = runMutant,
  log = console.log,
} = {}) {
  if (!rangeBase) return null;
  let registry = null;
  try {
    registry = await registryOf(rangeBase);
  } catch (error) {
    log(`     атрибуция не удалась: ${error.message}`);
    return null;
  }
  if (!registry) {
    log(`     атрибуция: реестр базы ${rangeBase} не прочитан`);
    return null;
  }
  const baseDefinition = registry.find((item) => item.id === mutant.id) || null;
  if (!baseDefinition) {
    log('     атрибуция: в базе такого свидетеля нет — отказ внесён этим диффом');
    return 'introduced';
  }
  log(`     атрибуция: определение базы на дереве базы ${rangeBase}…`);
  try {
    return setupFailureOwner(outcome, run(baseDefinition, { ref: rangeBase }));
  } catch (error) {
    log(`     атрибуция не удалась: ${error.message}`);
    return null;
  }
}
