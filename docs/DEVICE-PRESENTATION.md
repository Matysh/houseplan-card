# Отображение маркера устройства: таблица решений

Этот документ — developer-facing канон для issue
[#267](https://github.com/Matysh/houseplan-card/issues/267). Пользовательские
названия и обещания остаются в [USER-GUIDE.ru.md](USER-GUIDE.ru.md#12-визуальные-состояния-устройств);
здесь зафиксировано, как уже разрешённые факты превращаются в одно «лицо»
маркера. Любое изменение результата требует изменения строки, fixture и
mutation evidence в одном коммите. Правила выбора источника лица (порядок
cover → light sources → device role, шторы и медиаплееры) — в разделе
«Source precedence: what a marker shows» ниже; `FILTERING.md` решает только,
есть ли устройство на плане.

## Границы ответственности

- `device-visual.ts` классифицирует состояния сущностей.
- `device-presentation.ts` выбирает source graph и форматирует HA-данные.
- `device-presentation-policy.ts` — единственный владелец приоритета lifecycle,
  availability, static/live/value и диагностических gates.
- `device-pulse.ts` — единственный владелец эффекта activity.
- `device-face.ts` только рисует готовую проекцию.
- View, static card и preview получают один `ResolvedDevicePresentation`.
- Черновик диалога маркера проецируется `deviceFromMarkerDraft()` через
  `buildDevices` по полному сохранённому roster, где заменён только
  редактируемый маркер; поэтому владение целями, tombstones и лицо контроллера в
  preview совпадают с планом (#274).

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
| F10 | value auto + missing/unavailable/non-scalar | `content.value_fallback_icon` + `content.value_no_state/non_scalar` | icon fallback и точная причина | normal | `device-presentation-policy-value`; `presentation-row-contract` |
| F11 | value + несколько равноправных sources | `content.value_ambiguous_sources` | icon fallback `value_ambiguous_sources` | normal | `device-presentation-policy-value`; `presentation-row-contract` |
| F12 | value + virtual marker | `content.value_virtual` | icon fallback `value_virtual` | normal | `device-presentation-policy-value`; `presentation-row-contract` |
| F13 | dynamic icon + известный morph | `diagnostics.dynamic_icon` | state icon; действующее cover override сохранено | normal | `device-presentation-policy-diagnostics`; `presentation-row-contract` |
| F14 | explicit value badge | `diagnostics.value_badge` | один badge с resolved tone/position; bottom сдвигает LQI | normal | `device-presentation-policy-diagnostics`; `presentation-row-contract` |
| F15 | legacy automatic metric | `diagnostics.metrics_enabled` | прежняя temperature/humidity эвристика без записи config | normal | `device-presentation-policy-diagnostics`; `presentation-row-contract` |
| F16 | LQI 0/40, 41/179, 180+ | `diagnostics.lqi_low/mid/high` | low/mid/high и continuous canonical colour | normal | `device-marker-lqi-low-boundary-shifted`; `presentation-row-contract` |
| F17 | vacuum dynamic/static | `diagnostics.vacuum_live/vacuum_static` | live overlay только у видимого dynamic face | normal | `device-presentation-policy-diagnostics`; `presentation-row-contract` |
| F18 | value explicit + missing/unavailable/non-scalar | `content.value` + `content.value_no_state/non_scalar` | выбранный source сохраняется, Text face показывает `—` без auto/icon fallback | normal | `device-presentation-policy-value`; `presentation-row-contract` |

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

## Implementation notes

- `device-value-badge.ts` owns candidate discovery, source keys, HA formatting,
  units and unavailable handling for `marker.value_source` (inner Value face)
  and `marker.value_badge` (satellite). Absent `value_source` keeps the legacy
  automatic face resolver; absent `value_badge` keeps the legacy
  temperature/humidity satellite. Bottom badges stack above the system LQI row;
  a derived-LQI badge or value source suppresses that row.
- LQI: `devices.ts` averages Z2M `*_linkquality`, ZHA `*_lqi`/unit `lqi` sensors
  or a `linkquality`/`lqi` attribute. `logic.ts::lqiColor()` maps 40→180 to hue
  0→120; `markerLqiColor()` delegates to it; `markerLqiBand()` is marker-only
  accessibility metadata.
- Face geometry: the saved coordinate is the icon-core centre; Text is
  shell-centred and a Double shell extends around the anchored core. The
  101.5/80 shell/core ratio (`--device-shell-size`), shared centre, Light/Dark
  context, full-text fitting and the 44×44 core-centred interaction floor are
  renderer facts, not surface DOM. A positioned shell frame owns the whole
  visible capsule hit area and bubbles to the marker's one action path;
  Enter/Space call the same `_clickDevice()` path as pointer activation.
- Hit ownership: painted shells share one layer above all invisible 44 px
  floors, so DOM order never decides. `device-hit-owner.ts` resolves the owner in
  screen coordinates (painted capsule, else nearest core, stable id tie-break)
  from a small spatial index measured only after render/resize invalidation,
  never per pointer move, and latches it from pointerdown through
  hover/action/long-press/context menu and Devices-editor drag.
- Pulse storage: `ripple_color`/`ripple_size` remain the stored names for every
  pulse kind (alarm keeps safety red); absent size is 1.5; explicit colour/size
  wins, then live RGB, then presence-green/work-amber/transition-blue. The
  backend accepts legacy `display: ripple` only for compatibility;
  `normalizeDeviceDisplay()` maps it to `icon_ripple`.
- Activity baselines are seeded as soon as a rebuilt registry becomes
  authoritative, before the next HA snapshot is classified; a source-key change
  resets any finite effect immediately.
- The marker dialog builds its draft through `buildDevices`; `hp-device-preview`
  shows the actual projection, integration provenance from registry/config-entry
  metadata and isolated short/continuous demonstrations, fitting and centring the
  complete face bounding box so satellites never clip.
- Glow never replaces the yellow working plate: a light pool is spatial
  information, not a status indicator.

## Source precedence: what a marker shows

A marker's live indication — status plate, state-morphed icon and semantic
activity — is derived by one resolver from one effective source set. Action
selection is separate but shares `resolveToggleIntent` whenever the effective
action is Toggle state; `_actEntity` is legacy terminology and is not an
independent target resolver. Presentation source precedence is:

`display: static_icon` is the deliberate presentation exception to the matrix
below. The resolver still retains source metadata for preview diagnostics, but
the rendered marker always uses its base icon on a neutral dark plate: no state
morph, work/open/alarm/unavailable paint, activity, RGB, value or satellite
temperature/humidity/LQI badge. The live vacuum puck, trail and route warning
are also suppressed. This changes presentation only: hover/focus, service-call
feedback, controls, Glow and room light aggregation keep using the real device.
Hidden, removed or HA-disabled lifecycle rules still outrank display mode.

1. the resolved **cover** when `resolveToggleIntent` selected cover semantics.
   This includes current explicit `toggle` and losslessly-read legacy
   `tap_action: 'cover'`; the same exact entity drives open/close/stop and icon
   morph/activity. It wins over EVERYTHING below;
2. the marker's **resolved light sources** (`resolvedLightSources`): external
   `controls` plus its own primary controllable entity when `is_light: true`
   (an `entity:*` marker's bound entity and a `device:*` marker's child entities
   are excluded from the external list); `is_light: false` suppresses that own
   candidate, while missing/null discovers automatic `light.*` only when `light` is the
   device's resolved functional role. An auxiliary LED/display light on a
   media player or appliance does not turn the whole marker into a lamp. This
   exact set feeds Light fill, room light stats, marker feedback and group
   toggle. Glow additionally requires a spatial source: an external control
   never places a pool at the controller, while a real lamp marker or explicit
   `is_light: true` marker does. When both name the same entity, the physical marker
   owns its one Glow position regardless of registry order;

   A pre-v1.60 marker that lists its own `switch.*` in `controls` is ignored as
   a self-reference; it is not interpreted as `is_light`. Marker Save removes
   it, and Optimize Plans can remove the directly identifiable `entity:*` case.
   The dialog preserves the ordered raw list of genuine external controls,
   including duplicates and temporarily unknown targets; runtime consumers
   separately de-duplicate and keep only currently controllable entities.
3. otherwise the device's **resolved state role**
   (`resolvedDeviceStateEntities`): functional device domains first, then
   semantic binary signals, then one representative switch, then passive
   readings together. A switch-only device does not aggregate sibling feature
   toggles into its working state; this covers integrations which expose power,
   modes and options as uncategorised peer switches. If HA metadata identifies
   a dedicated Power entity in that composite controller, Power=on is neutral
   and Power=off uses the existing faded unavailable style. A lone relay is
   unchanged and remains yellow while on.
   `primaryEntity` is only the first entity of this same set for actions which
   require one target; it no longer defines marker availability by itself.

For `climate.*`, a recognized real `hvac_action`/equivalent action remains
authoritative: `idle` stays neutral even while the selected mode is `heat`,
while `heating`, `cooling`, `preheating` and `defrosting` are working. Unknown
vendor mode-like values in action attributes are ignored instead of suppressing
the normal enabled-mode fallback. If the integration exposes no recognized
action, the current non-off state is matched against HA's `hvac_modes` (plus the
standard modes) and used as the best available enabled/working approximation.

The original cover-first rule was added 2026-08-04 on the owner's report: his Aqara «Roller shade
driver E1» curtains ship the `cover.*` hidden by the integration and a visible
`switch.*_reverse_direction`, so `primaryEntity` picked the service switch —
the plan showed no ring while a curtain travelled, no `curtains` /
`curtains-closed` morph, and a yellow «включено» plate whenever the
reverse-direction option happened to be on. Issue #94 moves target selection
from the former `coverEntityOf` branch into the shared action resolver; the
indication still follows exactly the entity the tap would drive.

**Why the cover is FIRST and not third** (audit DEV-1DA1-01, fixed the same
day). It went in below `controls` and the lit light at first, and that left
the contract below («у штор не должно быть жёлтой подложки НИКОГДА») with two
holes big enough to walk through: a mixed device — a lamp that also ships a
blind — using the former explicit «Открыть/закрыть» action went yellow off its own lit `light.*`, and a
curtain marker with a bound wall switch went yellow off `controls`. In both
the early `return 'on'` never reached the cover branch, so the travelling
curtain also lost its breathing ring, and in glow fill (where the renderer
strips `on` from a shining source) it was left with no indicator at all —
while the tap still drove the cover. A rule that «шторы никогда не жёлтые»
cannot have exceptions decided by the neighbours in the entity list.

**Why it hangs on the resolved action target and not merely on “the device has
a cover”.** A mixed device may be a lamp with an auxiliary blind. The universal
action resolver first honours explicit controls, then an exact entity binding,
then the device's resolved functional role. Presentation adopts cover semantics
only when that same result selected the cover, so the option, hint, service call
and state shown cannot disagree. A no-target or unsupported result falls through
to ordinary light/device-role presentation and never invents a service target.

### Action authority (#94, #381)

`src/device-toggle.ts` is the only authority for Toggle: origin, exact target,
capability/security filtering, next effect and service command. The dialog hint,
click path, confirmation re-resolution and cover presentation consume the same
immutable `resolveToggleIntent` result. Exact `entity:` bindings never retarget
to siblings, persisted `controls` never fall back to the controller's own
entity, and secure targets are explicit no-ops. `POWER_ADAPTERS` is the explicit
domain allow-list and carries per-entity HA feature masks where a domain-wide
service is no capability proof; the HA service catalog is a second fail-closed
guard. `_clickDevice()`, shared by pointer and Enter/Space, stops propagation,
re-resolves the current marker by stable id (a retained #73 visual snapshot is
read-only presentation) and returns on explicit `tap_action: none` before
capability lookup, confirmation, cards/toasts, press feedback or HA dispatch;
hold and context-menu handlers stay independent.

### A media player is powered, not "working" (owner 2026-08-07)

The resolved role stays `media_player.*` for every TV, receiver, speaker and
soundbar; no model/name exception is involved. Its HA transport states
(`on`, `idle`, `playing`, `paused`, `standby`, etc.) all produce a neutral
marker with no running effect. Explicit `off` deliberately reuses the existing
`.dev.unavail` faded presentation used by `unknown` / `unavailable`; it does
not add another visual status. When a marker resolves several media entities,
it fades only if none is currently available and powered.

The media role also outranks auxiliary `light.*`/`switch.*` entities belonging
to the same physical device. Status LEDs, display illumination and vendor
options therefore neither paint the media marker nor enter room light
aggregates automatically. Explicit marker `controls` or `is_light` remains the
user override for a real light source.

### A cover is never painted (owner 2026-08-04)

«У штор не должно быть жёлтой подложки НИКОГДА, индикация открыто/закрыто за
счёт морфинга иконки.» For the `cover` domain — and for the cover selected by
the universal toggle resolver, rule 1 above — the visual resolver returns
no working/open plate in any state:

| cover state | plate | pulse | icon |
|---|---|---|---|
| `closed` | neutral | — | closed glyph |
| `open`, ajar (`open` + position) | neutral | — | open glyph |
| `opening`, `closing` | neutral | continuous pulse in Icon + state and activity | open glyph |
| `unknown` / no state | neutral | — | base icon, no morph |
| `unavailable` | neutral, faded (`.unavail`) | — | base icon |

Until this the domain shared one branch with `valve` and wore `.dev.open` —
an orange FILLED badge (`--hp-open`), not a mere border — while open or
opening. The open/closed story is now told by the icon alone (`stateIcon` /
`COVER_ICONS`), so the morph has to be exhaustive: every device class maps
its two states to two DIFFERENT glyphs, and a cover with no `device_class` at
all (z2m ships plenty) morphs within the family of its own base icon —
`mdi:roller-shade` (what the name rule «штор|curtain|blind|shade» hands out),
`mdi:garage-variant`, `mdi:blinds-horizontal`, `mdi:door`. The one place a
hand-picked icon is not final: a cover whose custom icon IS one of those pair
members morphs inside that pair — never traded for another family — because
otherwise choosing an icon would silently switch the marker's only indicator
off.

WHAT KEEPS THE FRAME. `.dev.open` is untouched everywhere else: door / window
/ garage_door / opening binary sensors, an unlocked `lock`, and `valve`. A
valve is deliberately left out of the owner's rule — no icon pair morphs for
it, so the frame is the only thing it has to say «открыт» with. If the owner
ever wants the two domains to read alike, a valve needs an icon pair first.
