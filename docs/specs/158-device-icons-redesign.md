# Issue #158 — обновление внешнего вида маркеров устройств

- Issue: [#158](https://github.com/Matysh/houseplan-card/issues/158)
- Приоритет: P1
- Ветка: `issue/158-device-icons`
- Статус документа: готово к реализации; issue намеренно остаётся в `S3-spec`
- Сравнительный прототип:
  [158-device-icons-comparison.html](158-device-icons-comparison.html)
- Основание: исходный пакет дизайна, аналитика от 2026-08-15, решения владельца
  от 2026-08-15 и 2026-08-17, итоговый архив дизайнера
  [`House plan Icons.zip`](https://github.com/user-attachments/files/31141782/House.plan.Icons.zip)

## 1. Пользовательская проблема и результат

Маркеры устройств — главный интерактивный слой House Plan, но текущая квадратная
плашка, отдельный value badge и разнородные кольца активности визуально тяжелее
плана и хуже читаются поверх сложного фона. Состояния существуют, однако их
оформление формировалось по частям: обычное устройство, тревога, виртуальное
устройство, значение, LQI, selected и pulse используют разные визуальные правила.

После #158 все поверхности используют один круглый glass Device Face:

- neutral, hover, working, open/unlocked, locked и alarm имеют единый язык;
- `value` становится круглой Text pill, а icon + внешний value badge — цельной
  Double-композицией;
- short, continuous и alarm pulse исходят из той же круглой геометрии;
- virtual, unavailable, editor selection и keyboard focus остаются различимыми;
- светлая и тёмная тема, цветной фон, отсутствие blur и размеры 32/56/96 px
  входят в проверяемый контракт;
- MDI glyph, state resolver, HA bindings, click/tap actions, координаты и
  сохранённые настройки не меняются.

Это визуальный redesign существующего поведения, а не новая система состояний.

## 2. Источники истины и их приоритет

При расхождении материалов применяется такой порядок:

1. решения владельца в issue;
2. это ТЗ;
3. действующие продуктовые контракты #98 и #90;
4. фактические SVG из итогового архива как visual/motion reference;
5. markdown-файлы внутри архива;
6. более ранние архивы и комментарии дизайнера.

Следствия:

- Continuous Working использует фактический animated SVG с циклом **3,6 с**,
  halo/aura и лёгким breathing core; строка `2,4 s` в
  `ACTIVE_ANIMATION_SPEC.md` итогового архива не нормативна;
- `Virtual Device Active.svg` не используется: у virtual нет semantic active,
  open/alarm и pulse;
- отдельные новые `Unavailable*.svg` не используются: действует текущая общая
  opacity `0.35`;
- новые SVG Zigbee LQI не используются: LQI остаётся без изменений;
- отсутствующий Double Open/Unlock строится из геометрии Double Active и
  зелёного semantic token `#1DC21D`;
- SVG — референсы для общего динамического DOM/CSS-компонента. Production не
  подменяет целиком SVG при изменении HA state и не встраивает Roboto data URI.

## 3. Подтверждённая техническая база

На момент подготовки ТЗ:

- `resolveDevicePresentation()` уже единожды проецирует availability, status,
  display, value badge, LQI и pulse для Full, Static и preview;
- `renderDeviceFace()` в `src/device-face.ts` является общей DOM-точкой для
  `interactive-plan`, `static-card` и `preview`;
- semantic classes `on`, `open`, `alarm`, `unavail`, `virtual`, `ghost`,
  `ha-disabled`, `sel` навешиваются owning surface;
- marker сейчас квадратный: `border-radius: 22%`, `1px` border,
  `--hp-bg/--hp-line`, glyph `62%` от `--dev-size`;
- hover заменяет ordinary `on/open` на accent, а alarm сохраняет красный;
- unavailable — opacity `0.35` на всей `.dev`;
- virtual — dashed border во всех состояниях;
- value-only ограничен шириной `4 × --dev-size`, использует ellipsis;
- внешний value badge поддерживает right/bottom/left/top и при bottom сдвигает
  системный LQI ниже;
- short — три волны по 1,1 с, continuous — одна бесконечная волна, alarm —
  отдельный красный pulse; reduced motion обычной активности использует dot;
- `ripple_color` и `ripple_size` уже сохранены в config и санитизируются перед
  передачей в CSS custom properties;
- `static_icon` намеренно запрещает live state, value и pulse;
- MDI glyph остаётся HTML overlay и не получает perspective transform в
  скрытой изометрии.

Текущий `DeviceStatus` не отличает `lock=locked` от ordinary neutral. Поэтому
чёрный Lock reference нельзя реализовать CSS-проверкой glyph. Presentation
должен получить неперсистентную lock-фасету (конкретное имя типа не нормативно),
вычисленную из выбранного доступного HA lock source:

- `locked`, только если authoritative lock state равен `locked`;
- `unlocked`, если state равен `unlocked/open` — он продолжает давать общий
  semantic status `open`;
- `null` для не-lock устройств, unknown/unavailable и неоднозначного источника.

Alarm/working/open имеют приоритет над locked-фасетой. Пользовательский MDI
`mdi:lock` на произвольном switch не создаёт locked state. Фасета не сохраняется
в config, не меняет actions и не добавляет новый источник активности.

## 4. Scope

### 4.1. Общий Device Face

- новый layered DOM/CSS face для icon и value-only;
- light/dark tokens, `backdrop-filter: blur(20px)` и `-webkit-` вариант;
- no-blur fallback без изменения semantic state;
- пропорциональное масштабирование от существующего `--dev-size`;
- единая геометрия Full, `houseplan-space-card`, `hp-device-preview` и preview
  диалога устройства;
- screen-parallel marker в flat и скрытой изометрии.

### 4.2. Состояния и overlays

- neutral/default, hover, working/active, open/unlocked, locked, alarm/alert;
- virtual default/hover;
- unavailable;
- editor selected, ghost и HA-disabled;
- `:focus-visible` для реально фокусируемого интерактивного marker;
- static icon;
- alert/continuous/short и reduced-motion варианты.

### 4.3. Значения

- Text для `display: value`;
- Double для icon + одного внешнего value badge;
- right/bottom/left/top;
- короткое, обычное и длинное значение, ellipsis и title/accessible text;
- сохранение legacy secondary metric и существующего LQI stacking.

### 4.4. Проверки и документация

- unit, browser smoke, golden и performance coverage;
- сравнительная страница из этого ТЗ как review aid, не production surface;
- RU/EN changelog и пользовательская документация в implementation commit.

## 5. Non-scope

- изменение MDI picker, auto-icon rules или fallback glyph;
- изменение resolver приоритетов HA state/activity из #98;
- новые HA bindings, service calls, действия click/tap или more-info;
- изменение источника, форматирования или сохранённой позиции value badge #90;
- редизайн Zigbee LQI, его градиента, шрифта, позиции или thresholds;
- отдельный unavailable visual помимо opacity `0.35`;
- virtual active/open/alarm или virtual pulse;
- low-zoom LOD, clustering, collision avoidance и автоматическое перемещение;
- touch-hover/pressed fixes из #22/#154;
- изменение vacuum puck, Glow, room fills, солнца, decor или backdrop;
- публичное включение скрытой изометрии;
- новые persisted поля, schema version или migration.

## 6. Нормативная геометрия и tokens

`--dev-size` продолжает означать пользовательский размер marker. В новой
геометрии это диаметр внешней основной оболочки без overflow shadow/pulse.

| Элемент | Сейчас | После #158 |
|---|---|---|
| Marker shell | квадрат, radius `22%` | круг, `100%` diameter |
| Core | отсутствует | круг `80/104 = 76.923%` shell |
| Glyph | `62%` marker | ориентир `40/104 = 38.462%` shell |
| Glass blur | нет | `20px`, без зависимости от marker size |
| Neutral outer border | `1px --hp-line` | `1.5px rgb(255 255 255 / 75%)` |
| Neutral core | `--hp-bg` | light `#fff`, dark theme-neutral surface |
| Neutral glyph | `--hp-txt` | light `#000`, dark контрастный token из reference |
| Hover | `--hp-accent` | core `#0C82F0`, белый glyph |
| Working | `--hp-on` | core `#F0A00C`, белый glyph, `3px` ring |
| Open/Unlock | `--hp-open` | core/ring `#1DC21D`, белый glyph, `2px` ring |
| Locked | neutral face | black core/ring по Lock reference, белый lock glyph |
| Alarm | `#6f2325/#f25a4a` | core/ring `#F0410C`, белый glyph, `2px` ring |
| Shadow | `--shadow-1` | `0 2px 3px rgb(37 40 45 / 12%)`, `0 8px 14px -2px rgb(37 40 45 / 18%)`, inner highlight `0 1px 1px rgb(255 255 255 / 70%)` |
| Text | rectangle, bold `45%` | round glass pill, Roboto/system regular `400` |
| Double | detached badge with gap | one glass composition with two inner sections |

Implementation may express the same pixels through equivalent relative CSS
tokens. Hardcoded reference-canvas coordinates `127/130/176px` are not copied
into production; ratios are normalized against `--dev-size`.

Supported visual checkpoints are 32, 56 and 96 px. Existing saved scale values
outside these checkpoints remain readable and are not clamped. Pointer/touch hit
area remains governed by the owning surface; this task does not silently move
the saved marker or expand collision geometry.

## 7. State and overlay matrix

### 7.1. Real device

| Resolver result / interaction | Face | Pulse | Overlay |
|---|---|---|---|
| neutral | Default | none | none |
| neutral + true mouse hover | Hover blue | unchanged | raised z-index |
| working | Active yellow | per #98/display | none |
| working + hover | Hover blue | cycle continues, not restarted | none |
| open/unlocked | Open green | per #98/display | none |
| open/unlocked + hover | Hover blue | cycle continues, not restarted | none |
| locked | Lock black reference | per existing activity | none |
| alarm | Alert red | alarm | none |
| alarm + hover | Alert red | alarm continues | hover may adjust shadow only |
| unavailable | resolved face × `opacity: 0.35` | none | no false active hover |
| selected | underlying face unchanged | unchanged | amber selection ring/glow |
| focus-visible | underlying face unchanged | unchanged | separate blue focus ring |
| selected + focus | underlying face unchanged | unchanged | both rings remain distinguishable; focus outermost |

Hover applies only for `@media (hover: hover) and (pointer: fine)` or the
equivalent existing pointer policy. Touch/pen must not latch a hover state.

### 7.2. Virtual

- shell is dashed in idle and hover;
- idle uses Default core/glyph;
- hover uses the same blue core/white glyph as a real neutral device, shell
  stays dashed;
- presentation is forced neutral and activity `none`;
- virtual never displays working/open/alarm face and never renders short,
  continuous or alarm pulse, even if an upstream source is malformed;
- selection/focus may wrap a virtual marker in an editor just like Default.

### 7.3. Unavailable, ghost and HA-disabled

- unavailable keeps exactly the existing wrapper opacity `0.35`; no separate
  fill, border, glyph or hover asset is used;
- source-level unavailable/missing value badge keeps its existing `0.66` local
  opacity in addition to wrapper state where applicable;
- hidden-device ghost and HA-disabled ghost keep current editor semantics,
  colors, plug-off badge and no-live-state rule; their chrome is layered over
  the new Default geometry rather than reclassified as a product state;
- unavailable/ghost/disabled never start pulse.

### 7.4. State precedence

Layers are composed rather than collapsed into one class:

1. availability/ghost visibility gate;
2. pulse behind marker;
3. virtual dashed-shell variant;
4. resolved semantic face;
5. hover face override for non-alarm real devices;
6. selected ring;
7. focus-visible ring;
8. new-device/HA-disabled badges, value badge and LQI.

Alarm always keeps the red semantic face. Focus and selection do not erase it.
Locked применяется только из нормативной lock-фасеты §3, а не из имени glyph.

## 8. Display modes and values

| Display / supplement | Target contract |
|---|---|
| `badge` | dynamic icon face plus eligible live state, alarm and external value |
| `icon_ripple` | same face plus short/continuous activity |
| `value` | Text pill; same availability/status/hover projection, no MDI |
| `static_icon` | Default face only; no live state, value, LQI or pulse |
| external value badge | Double composition when exactly one configured/legacy primary badge exists |
| legacy secondary metric | remains a second satellite; it is not merged into a third Double section |
| system LQI | current text, color, position and thresholds unchanged |

### 8.1. Text

- height equals the marker shell diameter;
- minimum width is one marker diameter, maximum stays `4 × --dev-size`;
- horizontal padding scales with marker size;
- text is one line, regular weight `400`, vertically and horizontally centred;
- overflow uses ellipsis; full text remains in `title`/accessible label;
- semantic background follows the same Default/Hover/Working/Open/Locked/Alarm tokens
  as icon core so current live-state information is not lost.

### 8.2. Double

- icon section keeps the exact marker anchor and `--dev-size`;
- value section joins it inside one outer glass outline;
- right/left extend horizontally; top/bottom extend vertically;
- text remains horizontal for every position;
- value section stays theme-neutral; semantic color affects the icon section
  and outer state ring;
- Default/Hover/Working/Alarm follow the provided four-position references;
- Open/Unlock uses Double Active geometry with `#1DC21D` ring/core;
- Locked uses the same Double geometry with the black Lock token;
- long value keeps the existing maximum width and ellipsis contract;
- no coordinate, badge source, formatting or persistence change is allowed;
- bottom Double still reserves the first satellite row and moves system LQI
  below the complete composition.

## 9. Motion contract

### 9.1. Alarm

- two red outline waves, `3px`, duration `2.4s`, second delay `1.2s`;
- easing `cubic-bezier(.22,.61,.36,1)`, maximum scale `1.5`;
- red soft wave and core breathing `1 → 1.055 → 1` follow the SVG;
- alarm is available for every dynamic display, independent of ordinary
  live-state styling, and absent for `static_icon`/unavailable/virtual;
- hover, selected and focus do not restart or recolor it;
- reduced motion: no looping transforms; one static red halo remains.

### 9.2. Continuous Working

- reasons and gating remain exactly #98: `presence`, `transition`, `running`,
  only for `display: icon_ripple`;
- one ring plus aura and subtle core breathing follow actual light/dark SVG;
- duration **3.6s**, easing `cubic-bezier(.45,.05,.55,.95)`, infinite;
- Default, Yellow and Green base variants are supported;
- default ring/aura color inherits semantic face; saved `ripple_color` overrides
  color and saved `ripple_size` overrides maximum diameter/scale;
- RGB light fallback and safe color sanitization remain unchanged;
- hover does not restart the timeline;
- reduced motion: ring hidden, static semantic aura/halo remains; no transform.

### 9.3. Short Activity

- reasons, edge generation and retrigger remain #98;
- three rings, each `1.1s`, delays `0/1.1/2.2s`, total `3.3s`, one-shot;
- a retrigger restarts at ring one through the existing generation identity;
- saved `ripple_color` and `ripple_size` keep priority;
- only centre/outline geometry changes to the circular shell;
- reduced motion keeps the existing static activity dot and no ring animation.

### 9.4. Runtime ownership

No timers or state are added to `renderDeviceFace()`. Existing activity runtime
owns short expiry/retrigger. CSS owns continuous/alarm animation. Re-rendering an
unchanged HA state must not reset infinite timelines.

## 10. Themes, background and fallback

- theme follows current HA light/dark context; no per-marker theme field;
- backdrop blur is `20px` for the glass shell and joined value surface;
- `-webkit-backdrop-filter` is included for supported WebViews;
- when backdrop-filter is unsupported, use an opaque theme-neutral surface with
  the same outline, state color and shadow; functionality never depends on blur;
- light, dark and non-uniform/colorful plan backgrounds are golden scenarios;
- `forced-colors` keeps a visible boundary and uses system colors where the
  glass/color design would disappear;
- no surface may sample or rewrite the underlying plan color.

## 11. Surfaces and parity

The following consume the same state resolver, shared face markup and tokens:

| Surface | Live state | Hover/action | Values/pulse | Notes |
|---|---:|---:|---:|---|
| Full View | yes | yes | yes | canonical interactive surface |
| Device editor View | yes | drag/select | yes | editor overlays compose |
| `houseplan-space-card` | yes | no device action/hover | yes | read-only parity |
| `hp-device-preview` | yes/demo | preview controls | yes | exact saved settings |
| marker dialog preview | yes/demo | no production service call | yes | safe area includes Double/pulse |
| hidden isometric View | yes | yes | yes | face stays screen-parallel |

`static_icon` is a display mode, not the same thing as the static space card.

## 12. Architecture contract

### 12.1. One renderer

- extend `renderDeviceFace()` with stable semantic layers (`shell`, `core`,
  glyph/value, overlays) rather than duplicating markup per surface;
- keep owning wrapper responsible for coordinates, pointer handlers, tooltip,
  selection and surface-specific accessibility;
- keep `resolveDevicePresentation()` and `resolveDevicePulse()` as the only
  semantic projection; CSS must not infer HA state from glyph names;
- Double geometry is a layout variant of the same face/value badge, not a new
  value resolver;
- raw designer SVG may be used in tests/reference only, not as runtime state
  components.

### 12.2. CSS tokens

New CSS custom properties must have one definition point and safe fallbacks.
Expected groups:

- geometry: face/core ratio, outline widths, joined badge gap/overlap;
- theme: glass/core/glyph/shadow;
- semantic: hover/working/open/locked/alarm;
- overlay: selected/focus;
- motion: color and maximum scale.

Inline user colors continue through `safeRenderColor()`. No unsanitized config
string is interpolated into CSS, class or SVG markup.

### 12.3. Stable DOM

- unchanged state frames reuse the same node structure;
- animation layers exist only when the resolver returns a pulse;
- `will-change` is limited to actively animated layers and removed otherwise;
- no canvas snapshot, data-URI font or one-SVG-per-state download is introduced.

## 13. Data, compatibility and migration

- config schema and storage are unchanged;
- `display`, `ripple_color`, `ripple_size`, marker scale/angle, value badge source
  and position round-trip byte-for-byte when not edited;
- old configs receive the new visual automatically;
- future/unknown config fields remain lossless;
- no import/export version bump;
- rollback to the previous bundle restores the old visual without data loss;
- cached/restored snapshots need no migration.

## 14. Accessibility, keyboard and touch

- glyph/state remains represented by existing accessible device name/state;
- values expose the full untruncated string;
- a focusable interactive marker gains a `:focus-visible` ring; programmatic or
  pointer focus must not create persistent keyboard chrome;
- selected and focus are not color-only aliases of working/alarm;
- reduced motion rules in §9 are mandatory;
- marker touch behaviour, gesture arbitration and action targets do not change;
- static/read-only surfaces do not become focusable solely for appearance;
- true hover is never synthesized from touch/pen.

## 15. Performance, security and observability

### 15.1. Performance

The main risk is a dense plan with many blur/shadow and simultaneous motion
layers. Requirements:

- no JS work per animation frame;
- no new geometry/resolver computation on unchanged HA frames;
- blur is confined to marker/value bounds, not a plan-wide layer;
- hidden/static/unavailable/virtual markers allocate no pulse layers;
- existing absolute performance budgets remain green;
- add a dense-device browser scenario containing neutral, Double and concurrent
  continuous markers in both themes; its accepted budget is explicit and may
  not weaken an existing profile;
- compare GPU/compositor behaviour on the Windows Chromium harness and in Linux
  CI before beta.

### 15.2. Security

- only sanitized colors enter CSS variables;
- values remain text nodes, never `unsafeHTML`;
- no external font/network resource is loaded;
- designer archive is not served to HA users;
- pointer/click/service-call policy is unchanged.

### 15.3. Diagnostics

No user-facing telemetry is added. Existing smoke/golden names and issue-linked
test evidence are the diagnostic contract.

## 16. Сравнительная тестовая страница

`docs/specs/158-device-icons-comparison.html` is a self-contained review aid.

It must:

- render columns «Сейчас» and «После #158» from one row matrix;
- cover every row in §7–§9 plus Text, four Double positions, LQI unchanged,
  ghost/disabled and static icon;
- offer light/dark, plain/colored background, 32/56/96 px and reduced-motion
  controls;
- require no build, server, HA session, font or network request;
- show the accepted owner overrides prominently;
- never be imported by production code or included as a runtime asset contract.

The page is illustrative at S3: the target column is a CSS rendering of the
normative design, not proof that production is implemented. Golden evidence
must later capture the real card bundle.

## 17. Acceptance criteria

1. All supported surfaces use one shared circular Device Face and match the
   state matrix without duplicated semantic logic.
2. Default/Hover/Working/Open/Locked/Alarm match target tokens in light/dark,
   on plain and colored backgrounds, at 32/56/96 px.
3. Hover replaces ordinary neutral/working/open face with blue but never hides
   alarm; touch/pen does not latch hover.
4. Virtual is dashed in idle/hover and can never become semantic or animated.
5. Unavailable is exactly the current `0.35` wrapper opacity and never pulses.
6. Selected and focus-visible compose over every semantic face; alarm remains
   red and focus remains visible.
7. Text and Double preserve source/format/position, all four positions, maximum
   width, ellipsis, full accessible text and bottom-LQI stacking.
8. Double Open uses green Active geometry; value section remains neutral.
9. Locked face is derived only from an available authoritative lock state and
   works for icon, Text and Double without inspecting the selected glyph.
10. LQI pixels/thresholds/position remain unchanged except unavoidable common
   movement caused by the joined Double footprint.
11. Alarm pulse matches the 2.4s two-wave contract; Continuous matches the 3.6s
    SVG contract; Short remains 3.3s/retriggerable.
12. `ripple_color`/`ripple_size` override ordinary motion without affecting
    alarm and survive round-trip.
13. Reduced motion has no looping transforms: alarm/continuous retain static
    halo and short retains the dot.
14. `static_icon` remains neutral and pulse/value-free on every surface.
15. No-blur fallback retains state readability and focus boundary.
16. Existing actions, bindings, positions, MDI, Glow, vacuum and configuration
    remain unchanged.
17. Typecheck, unit and build are green in implementation cycle; named smokes,
    golden, mutation guards and performance gates are green before beta.

## 18. Test plan

### 18.1. Unit

Extend/add tests for:

- `device-face`: stable layer DOM, class/style projection, Text/Double positions,
  full value text, LQI stacking;
- `device-presentation`: real vs virtual/unavailable/static gates;
- `device-visual`/presentation: authoritative lock source produces the transient
  locked facet; custom lock glyph and unrelated entities do not;
- `device-pulse`: 3.6s presentation contract metadata if represented in TS,
  saved color/scale priority, reduced motion;
- source/token contract tests that prevent reintroduction of Virtual Active,
  redesigned unavailable or redesigned LQI;
- theme/fallback CSS anchors and safe user color interpolation.

### 18.2. Browser smoke

Add `demo/smoke_device_face_redesign.mjs` and extend
`demo/smoke_device_preview_parity.mjs`:

- compare semantic classes and bounding boxes across Full, Static and preview;
- measure 32/56/96, Text and all Double positions rather than only counting DOM;
- assert alarm remains red through hover/selected/focus;
- assert virtual is dashed and has zero pulse nodes;
- assert unavailable opacity and zero pulse nodes;
- assert long values fit/ellipsis and title contains full value;
- assert no uncaught errors on theme/background/motion switches;
- sample at least two distinct animation frames for Continuous and a complete
  Short retrigger instead of checking only animation-name.

### 18.3. Golden

Add real-card scenarios, at minimum:

- state matrix light and dark;
- colored/non-uniform plan background;
- Text + Double right/left/top/bottom;
- virtual/unavailable/selected/focus;
- alarm/continuous fixed frames and reduced motion;
- Full/Static/preview parity;
- 32/56/96 checkpoints.

Every issue-specific golden carries a semantic pixel/geometry assertion and is
proven red by a mutation before acceptance.

### 18.4. Mutation gate

Add 2–5 meaningful guards, for example:

1. remove virtual dashed shell;
2. allow pulse for virtual/unavailable;
3. change unavailable opacity from `0.35`;
4. let hover override alarm;
5. detach one Double position or change Continuous duration.

Each mutation must make its named unit/smoke/golden check fail.

### 18.5. Commands and stage

Implementation cycle:

```text
npm run typecheck
npm test
npm run build
```

Before moving implementation to code review, run the AC-named local browser
smokes. Before beta, run golden verify, mutation gate, relevant performance
profiles and the full Linux CI HA harness according to `AGENTS.md`/`PROCESS.md`.

## 19. Implementation plan

1. Introduce normalized visual tokens and layered shared face markup.
2. Implement Default/semantic/hover/virtual/unavailable and overlays.
3. Implement Text and joined Double while preserving the #90 resolver.
4. Restyle alarm/continuous/short without changing #98 ownership/gates.
5. Apply parity to Full, Static, preview and hidden isometry.
6. Add fallback/accessibility/forced-colors/reduced-motion rules.
7. Add unit, smoke, golden, mutation and dense performance evidence.
8. Update documentation, both changelogs and generated bundles in the same
   user-visible implementation commit.

## 20. Release artifacts

The implementation commit is `User-Visible: yes` and must include:

- `docs/CHANGELOG.md`;
- `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` marker states/display documentation;
- `docs/TESTING.md` checklist and exact automated evidence;
- updated screenshot/golden baselines and baseline index;
- production bundle copies required by repository policy;
- release notes wording when the containing beta is prepared.

No separate config compatibility note is required beyond documenting that data
and saved settings are unchanged.

## 21. Risks and mitigations

| Risk | Mitigation |
|---|---|
| blur/shadow cost on dense plans | confined layers, dense benchmark, no JS frame loop |
| semantic state lost under hover | explicit matrix and alarm-hover smoke |
| package contradicts owner decisions | source precedence §2 plus contract tests |
| Full/Static/preview drift | shared face + parity smoke/goldens |
| value clipping after joining | four-position geometry smoke at max scale/value |
| sticky hover on touch | fine-pointer media/pointer policy smoke |
| animation restarts on HA frames | stable DOM/runtime ownership and frame sampling |
| user customization silently removed | round-trip and override tests |
| glass invisible without blur | opaque fallback and forced-colors checks |

## 22. Rollback

Rollback is a revert of the implementation commit and rebuilt bundle. No config,
backend or migration rollback is needed. Golden baselines and new visual tests
are reverted with the feature; #98/#90 behavioural tests remain.

## 23. Принятые предположения

- `--dev-size` maps to the new outer shell diameter; shadow overflow is not part
  of anchoring.
- Exact reference-canvas offsets are normalized to relative ratios.
- Double Open/Unlock is Active geometry recolored to `#1DC21D`.
- Locked Text/Double reuse the black Lock token through the transient lock
  facet; no persisted status or glyph heuristic is introduced.
- Text semantic variants absent from exports are produced from the same shared
  tokens so existing live-state behaviour is not lost.
- Static editor ghost/disabled chrome is retained over the new Default face.
- The comparison HTML is a specification aid and does not authorize product
  code at `S3-spec`.
- Any conflict not resolved by §2 returns to the owner instead of being inferred
  during implementation.
