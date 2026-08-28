# Отображение маркера устройства: таблица решений

Этот документ — developer-facing канон для issue
[#267](https://github.com/Matysh/houseplan-card/issues/267). Пользовательские
названия и обещания остаются в [USER-GUIDE.ru.md](USER-GUIDE.ru.md#12-отображение-устройств);
здесь зафиксировано, как уже разрешённые факты превращаются в одно «лицо»
маркера. Любое изменение результата требует изменения строки, fixture и
mutation evidence в одном pull request.

## Границы ответственности

- `device-visual.ts` классифицирует состояния сущностей.
- `device-presentation.ts` выбирает source graph и форматирует HA-данные.
- `device-presentation-policy.ts` — единственный владелец приоритета lifecycle,
  availability, static/live/value и диагностических gates.
- `device-pulse.ts` — единственный владелец эффекта activity.
- `device-face.ts` только рисует готовую проекцию.
- View, static card и preview получают один `ResolvedDevicePresentation`.

`decisionIds` — внутренний bounded trace. Он не показывается человеку, не
содержит entity IDs и не сохраняется в конфигурацию.

## Lifecycle и видимость

| ID | Вход | Решение | Наблюдаемый результат | Интерактивность | Доказательство |
|---|---|---|---|---|---|
| L01 | `marker.removed:true` | `pre.lifecycle.removed` | marker отсутствует в roster/DOM | отсутствует | `devices` tombstone test; `presentation-row-contract` |
| L02 | HA-disabled, View/киоск/static | `lifecycle.ha_disabled_hidden` | face скрыт, live state не участвует | отсутствует на View | `device-presentation-policy-lifecycle`; `presentation-row-contract` |
| L03 | HA-disabled, Device editor | `lifecycle.ha_disabled_hidden` | служебный ghost/preview с причиной `ha_disabled`, без live face | editor-owned, без service action | `device-presentation-policy-lifecycle`; `presentation-row-contract` |
| L04 | user-hidden, View/киоск/static | `lifecycle.user_hidden` | marker и hit-area скрыты | отсутствует | `device-presentation-policy-user-hidden`; `presentation-row-contract` |
| L05 | user-hidden, design preview | `lifecycle.user_hidden_preview` | сохранённый дизайн видим; notice `hidden_design_preview` | preview inert | `device-presentation-policy-user-hidden-preview`; `presentation-row-contract` |
| L06 | orphaned binding | `lifecycle.orphaned_diagnostic` | нейтральная диагностическая проекция с причиной, pulse/service не оживают | surface-owned safe path | `device-presentation-policy-orphaned`; `presentation-row-contract` |

## Источник лица и доступность

| ID | Вход | Решение | Наблюдаемый результат | Интерактивность | Доказательство |
|---|---|---|---|---|---|
| S01 | cover — primary/роль | `source.cover` | `sourceKind=cover`; morph с exact cover | normal surface action | `presentation-source-decision-trace`; `presentation-row-contract` |
| S02 | cover — побочная capability при light/role | `source.cover_capability_bypassed` | cover не перехватывает выбранный face | normal | `presentation-source-decision-trace`; `presentation-row-contract` |
| S03 | есть active external controls | `source.controls` + `availability.controller_available` | status берётся от целей, availability — от контроллера | normal | `controller-availability-follows-target`; `presentation-row-contract` |
| S04 | цели unavailable, controller имеет live diagnostic | `availability.controller_available` | доступная нейтральная подложка, не `unavail` | normal | `controller-diagnostics-do-not-prove-online`; `presentation-row-contract` |
| S05 | у controller есть собственные entities, но ни одной live entity; цель работает | `availability.controller_unavailable` | faded controller; нет yellow/pulse | normal action сохраняется | `controller-availability-follows-target`; `presentation-row-contract` |
| S06 | virtual controller + controls | `source.virtual_controller` | controller доступен; status следует цели | normal | `presentation-source-decision-trace`; `presentation-row-contract` |
| S07 | все saved controls отфильтрованы tombstone | `source.filtered_saved_controls` | controller-role сохранён, availability дают свои diagnostics | normal | `wireless-controller-loses-filtered-target-role`; `wireless-controller-preview-drops-sibling-markers` |
| S08 | manual virtual light с outgoing controls | `source.manual_virtual_light` | собственный manual source владеет face | normal | `presentation-source-decision-trace`; `presentation-row-contract` |
| S09 | owned real/forced light | `source.owned_light` | собственный light владеет face | normal | `presentation-source-decision-trace`; `presentation-row-contract` |
| S10 | есть functional device role | `source.device_role` | aggregate роли становится face | normal | `presentation-source-decision-trace`; `presentation-row-contract` |
| S11 | registry role временно отсутствует, есть primary | `source.primary_fallback` | deterministic primary fallback | normal | `presentation-source-decision-trace`; `presentation-row-contract` |
| S12 | пригодного source нет | `source.none` | neutral base-icon fallback | normal | `presentation-source-decision-trace`; `presentation-row-contract` |
| S13 | critical alarm sibling вне обычного source | `source.critical_sibling` + `status.alarm` | alarm добавлен в aggregate и побеждает normal status | normal | `device-presentation-policy-alarm`; `presentation-row-contract` |
| S14 | static plan fast path без source details | `source.skipped_static_fast_path` | source graph намеренно не вычисляется; static face остаётся neutral | normal; без source-derived данных | `presentation-static-source-fast-path`; `presentation-row-contract` |
| S15 | active physical `device:` controller с пустым собственным roster + controls | `availability.controller_available` | status следует цели: working = yellow, off/unavailable/missing = neutral; controller не faded | normal | `entityless-active-controller-stays-available`; `presentation-row-contract` |

## Финальное лицо, контент и диагностика

| ID | Вход | Решение | Наблюдаемый результат | Интерактивность | Доказательство |
|---|---|---|---|---|---|
| F01 | dynamic + alarm | `status.alarm` | красный alarm face | normal | `device-presentation-policy-alarm`; `presentation-row-contract` |
| F02 | dynamic + unavailable | `status.unavailable` | faded neutral plate, без pulse/hover paint | normal action сохраняется | `device-presentation-policy-unavailable`; `device-unavailable-hover-restored` |
| F03 | lock locked/unlocked | `source.device_role` + `status.neutral/open` | `lock-locked` / `lock-unlocked`, согласованный a11y state | normal | `presentation-source-decision-trace`; `presentation-row-contract` |
| F04 | working available | `status.working` | yellow plate | normal | `device-presentation-policy-status`; `presentation-row-contract` |
| F05 | open available, не cover | `status.open` | orange plate | normal | `device-presentation-policy-status`; `presentation-row-contract` |
| F06 | neutral available | `status.neutral` | theme-neutral plate | normal | `device-presentation-policy-status`; `presentation-row-contract` |
| F07 | `live_states:false`, не alarm | `face.live_states_disabled` | neutral/base icon; ordinary activity off | normal | `device-presentation-policy-live-gate`; `presentation-row-contract` |
| F08 | `static_icon` | `face.static` | neutral/base icon; state/RGB/value/metrics/pulse/vacuum off | normal | `device-presentation-policy-static`; `presentation-row-contract` |
| F09 | value + один scalar source | `content.value` | HA-formatted full Text face | normal | `device-presentation-policy-value`; `device-long-value-ellipsis-restored` |
| F10 | value + missing/unavailable/non-scalar | `content.value_fallback_icon` + `content.value_no_state/non_scalar` | icon fallback и точная причина | normal | `device-presentation-policy-value`; `presentation-row-contract` |
| F11 | value + несколько равноправных sources | `content.value_ambiguous_sources` | icon fallback `value_ambiguous_sources` | normal | `device-presentation-policy-value`; `presentation-row-contract` |
| F12 | value + virtual marker | `content.value_virtual` | icon fallback `value_virtual` | normal | `device-presentation-policy-value`; `presentation-row-contract` |
| F13 | dynamic icon + известный morph | `diagnostics.dynamic_icon` | state icon; действующее cover override сохранено | normal | `device-presentation-policy-diagnostics`; `presentation-row-contract` |
| F14 | explicit value badge | `diagnostics.value_badge` | один badge с resolved tone/position; bottom сдвигает LQI | normal | `device-presentation-policy-diagnostics`; `presentation-row-contract` |
| F15 | legacy automatic metric | `diagnostics.metrics_enabled` | прежняя temperature/humidity эвристика без записи config | normal | `device-presentation-policy-diagnostics`; `presentation-row-contract` |
| F16 | LQI 0/40, 41/179, 180+ | `diagnostics.lqi_low/mid/high` | low/mid/high и continuous canonical colour | normal | `device-marker-lqi-low-boundary-shifted`; `presentation-row-contract` |
| F17 | vacuum dynamic/static | `diagnostics.vacuum_live/vacuum_static` | live overlay только у видимого dynamic face | normal | `device-presentation-policy-diagnostics`; `presentation-row-contract` |

## Activity и pulse

| ID | Вход | Решение | Наблюдаемый результат | Интерактивность | Доказательство |
|---|---|---|---|---|---|
| A01 | alarm, dynamic; `live_states` любое | `pulse.alarm_alarm` | красный alarm pulse; hidden/disabled/static подавляют | normal | `device-presentation-policy-alarm`; `presentation-row-contract` |
| A02 | ordinary activity, display не `icon_ripple` | `activity.pulse_suppressed` | pulse нет; notice `activity_display_disabled` | normal | `device-presentation-policy-pulse-gate`; `presentation-row-contract` |
| A03 | witnessed event/transition, окно 3.3 s | `pulse.short_event/transition` | short pulse с generation/deadline; после deadline `none` | normal | `device-presentation-policy-pulse-gate`; `presentation-row-contract` |
| A04 | presence active | `pulse.continuous_presence` | continuous green | normal | `device-presentation-policy-pulse-gate`; `presentation-row-contract` |
| A05 | opening/closing transition | `pulse.continuous_transition` | continuous blue | normal | `device-presentation-policy-pulse-gate`; `presentation-row-contract` |
| A06 | running/working | `pulse.continuous_running` | continuous amber/live-RGB/configured | normal | `device-presentation-policy-pulse-gate`; `presentation-row-contract` |
| A07 | unavailable/hidden/disabled/static | `activity.pulse_suppressed` + `pulse.none_none` | retained runtime не рисуется | normal либо отсутствует по lifecycle | `device-presentation-policy-pulse-gate`; `presentation-row-contract` |
| A08 | reduced motion | `pulse.continuous_presence` (либо соответствующий `pulse.short_*`) | ordinary wave заменён dot; alarm остаётся красным без ordinary dot | normal | `device-presentation-policy-pulse-gate`; `presentation-row-contract` |

## Порядок приоритетов

1. lifecycle и effective visibility;
2. static face;
3. critical alarm;
4. live-state gate;
5. controller availability против target aggregate;
6. stable status;
7. value/icon fallback;
8. metrics, live colour и vacuum live;
9. единственный `resolveDevicePulse()`.

Неуказанная ось не влияет на строку. Новая комбинация получает новый ряд
только тогда, когда меняет победившее решение или наблюдаемый результат; полное
декартово произведение binding × source × display × activity запрещено.
