// #659: browser mutation witnesses are expensive. These contracts cover the
// state, generated SVG/CSS and handler wiring that does not need a browser.
// Behavioural unit suites still run beside this file; the source assertions
// protect the wiring that cannot be imported without instantiating Lit/HA.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const contains = (file, ...parts) => {
  const text = source(file);
  for (const part of parts) assert.ok(text.includes(part), `${file}: missing ${JSON.stringify(part)}`);
  return text;
};

test('#659 pure state writers keep one-way ownership and current request claims', () => {
  const stairs = contains('src/stairs-editor.ts',
    'this.write(this.stairs.map((item) => item.id === next.id ? next : item));',
    "this.owner._recordGeometry(this.owner._t('history.stair_edit'), before);",
  );
  assert.doesNotMatch(stairs, /-mirror|_serverCfg\.spaces\.find/);
  contains('src/version-recovery-card.ts',
    '(response) => adoptCardConfigCapabilities(host, response),');
  contains('src/vacuum-calibration-write.ts', 'const space = proposal.space || device.space;');
  contains('src/device-inbox.ts',
    'if (isRemovedPlanEntity(h, eid, removed) && !removedBindings.has(value) && !childOfRemovedDevice) continue;');
  contains('src/config-reload-authority.ts', "profile: 'reload',\n      isCurrent,\n      afterAdopt:");
});

test('#659 summary lifecycle keeps outgoing content mounted and first paint non-blocking', () => {
  const runtime = contains('src/summary-panel-runtime-loaded.ts',
    'if (!this.presentation.mounted) return nothing;',
  );
  assert.doesNotMatch(runtime, /!this\.presentation\.mounted \|\| !this\.local\.show/);
});

test('#659 common dialogs and keyboard markers keep their source-level wiring', () => {
  contains('src/hp-confirm.ts',
    "<ha-icon icon=${request.confirmIcon || (destructive",
  );
  contains('src/editors/form-kit.ts', 'onInput: () => undefined,');
  contains('src/hp-dialog.ts',
    '--ha-dialog-width-md: 560px;',
    '--ha-dialog-min-height: var(--safe-height, 100dvh);',
    '--ha-dialog-max-height: var(--safe-height, 100dvh);',
  );
  contains('src/styles/dialogs.styles.ts',
    'background: var(--hpf-canvas, var(--secondary-background-color, color-mix(in srgb, var(--card-background-color, var(--hp-bg, #202126)) 90%, var(--primary-text-color, #000))));',
  );
  contains('src/styles/devices.styles.ts',
    'transition: border-color .15s, opacity .2s;',
  );
  contains('src/summary-panel-editor.ts',
    ".title=${t('summary.settings')} wide",
    '.checked=${dialog.draft.show_on_mobile} ?disabled=${!dialog.localShow || dialog.busy}',
  );
  contains('src/device-inbox-batch.ts',
    '  try {\n    await deps.saveConfigNow(); // #618 B5: one write per batch\n    refreshRows();',
  );
});

test('#659 2.5D CSS and generated material contracts stay unit-testable strings', () => {
  contains('src/styles/iso-tiles.styles.ts',
    '.stage.projection-iso.mode-view .dev .device-shell-frame {\n    border-color: transparent;',
    'pointer-events: none;\n    z-index: -1;',
    '.dev.sel:not(:focus-visible) { --iso-frame: #F0A00C; }',
    '.stage.projection-iso.mode-view .iso-tile-shadows { display: none; }',
    '@media (forced-colors: active) {\n    .stage.projection-iso.mode-view .iso-tile-shadows { display: none; }',
  );
  contains('src/iso-tiles.ts', '${S} .dev .device-shell.with-values { gap:');
  contains('src/iso-sun.ts',
    'const streaks = beam.lightFloor ? [inset / length, 1 - inset / length] : [];');
  contains('src/iso-scene-render.ts',
    'const wallHeight = gridVisualUnits(ISO_WALL_HEIGHT, input.cellCm);\n'
      + '  const floorEdgeHeight = gridVisualUnits(ISO_FLOOR_EDGE_HEIGHT, input.cellCm);\n'
      + '  const raisedHeight = gridVisualUnits(ISO_RAISED_OVERLAY_HEIGHT, input.cellCm);\n'
      + '  const cached = lruRead(input.cache, input.source.key);',
    'return svg`<path class="iso-wall-top" d=${face.d} data-component=${face.component}');
  contains('src/hp-color-opacity.ts', 'return this.flatSwatch && !this.coverSwatch;');
});

test('#659 Glow fallbacks, blockers and feather remain explicit pure contracts', () => {
  contains('src/glow-scene.ts',
    '  console.warn(\n'
      + '    `HOUSEPLAN GLOW GEOMETRY FALLBACK: #218, space ${spaceId}, room ${roomId}, phase ${phase}`,\n'
      + '  );',
    'return pointInOpaquePlanBody(\n    [source.x, source.y], scene.masonryGeometry, scene.opaqueBodies,',
    'opening.x - dx, opening.y - dy,\n      opening.x + dx, opening.y + dy,',
    'const opaqueBodies = input.physicalBodies(partitionCuts, cacheKey);',
    'export const GLOW_EDGE_FEATHER_PX = 2;',
  );
});

test('#659 header menu state transitions are guarded without rendering a browser menu', () => {
  contains('src/header-menu.ts',
    'const run = (item: HeaderMenuItem) => { this.close(false); item.run(); };',
    "if (event.key !== 'Escape' || !this.open) return;",
    'if (!nav || !tab || nav.clientWidth === 0) return;',
  );
});

test('#659 live editor templates own guides in every editor and hide settled copies', () => {
  contains('src/live-editor.ts',
    '${host._renderAlignGuides()}\n  </g>`;',
    '${host._renderDecorLayer(activeId)}\n      ${host._renderAlignGuides()}',
    '${host._renderAlignGuides()}\n    ${host._tool === \'draw\' ? nothing : host._renderPlanSnapOverlay()}',
    "makeTransparent(state, root, '.hp-editor-only-layer:not(.hp-plan-snap-layer)');\n  if (host._mode === 'plan') {",
  );
});

test('#659 settings handlers preserve dirty, discard, inversion and field ownership', () => {
  contains('src/editors/space-form.ts',
    'onChange: (v) => set(port, { ...d, fillMode: v }),',
    'const canSave = dirty && problems.length === 0 && !d.busy;',
    'if (!dirty || d.busy) { close(); return; }',
    'checked: !d.hideDecor, onChange: (v) => set(port, { ...d, hideDecor: !v }),',
  );
  contains('src/editors/general-settings-dialog.ts',
    "? callout({ kind: 'warning', role: 'status', text: t('gs.sun_missing') })",
    "title: t('gs.card_fills'),",
    'const canSave = dirty && problems.length === 0 && !d.busy;',
    'onOpacity: (a) => this._setFillColor(key, { c: v.c, a }),',
    "textLink(t('gs.north_clear'), () => set({ northDeg: null, northDegInput: '' }))",
  );
  contains('src/hp-zigbee-topology-settings.ts',
    'if (this.embedded) return this._renderEmbedded();');
  contains('src/editors/room-settings-dialog.ts',
    "if (kind === 'temp') host._roomTempSrc = v;\n    else host._roomHumSrc = v;",
    'const canSave = problems.length === 0 && tempValid && (edit ? dirty : true);',
    'if (!edit || !dirty) { close(); return; }',
    "onChange: (v) => setFill(v ? '' : startMode()),",
    'onInput: (raw) => { host._roomTempMin = raw; host.requestUpdate(); },',
  );
});

test('#659 marker handlers preserve callouts, baselines and explicit user choices', () => {
  contains('src/editors/marker-dialog.ts',
    'if (value === d.binding) {',
    "? callout({ kind: 'warning', role: 'status', text: t('marker.run_target_gone', { id: d.tapTarget }) })",
    '&& (edit ? dirty : true);',
    '@click=${() => { void this._saveMarker(); }}',
    'if (edit && dirty && !await this.host._confirmDanger({',
    "${effectiveTapAction === 'run' || effectiveTapAction === 'toggle'",
    "markerglowblock ${glowSourceDisabled ? 'hpf-disabled' : ''}",
    'valueBadgePosition: position,\n                  valueBadgeTouched: true,',
  );
});

test('#659 room gear drag keeps the click suppression window after a real move', () => {
  contains('src/room-gear-drag.ts',
    'this.suppressClickUntil = performance.now() + 700;');
});

test('#676 stair gestures swallow the synthesized click and the View tooltip keeps the link condition', () => {
  // Gesture → click suppression: the drag end (draft or handle) arms the host's
  // `_suppressClick` for one tick, and every frame handle stops its own click.
  // `demo/smoke_stairs.mjs` proves the behaviour in Chromium (AC6/AC8); this is
  // the Node witness for the wiring that Lit templates cannot expose.
  const editor = contains('src/stairs-editor.ts',
    '    this.owner._suppressClick = true;\n'
      + '    setTimeout(() => { this.owner._suppressClick = false; }, 0);\n',
    '      this.draft = null;\n      this.swallowNextClick();\n',
    '    if (!drag || drag.pid !== event.pointerId) return false;\n    this.swallowNextClick();\n',
    "@pointerdown=${(event: PointerEvent) => this.pointerDown(event, stair, 'resize', { sx: handle.sx, sy: handle.sy })}\n"
      + '        @click=${stop}></circle>',
    "@pointerdown=${(event: PointerEvent) => this.pointerDown(event, stair, 'rotate')}\n"
      + '          @click=${stop}></circle>',
  );
  assert.equal((editor.match(/@click=\$\{stop\}/g) || []).length, 2, 'both handle kinds stop their click');
  // Tooltip only where the stair is a link: the same `active` that gates navigation.
  const view = contains('src/stairs-view.ts',
    '      const tip = (event: PointerEvent): void => {\n        if (!active) return;\n',
    "this.owner._showTip(event, this.owner._t('stairs.tooltip_navigate', { title: targetTitle }), '');",
  );
  assert.doesNotMatch(view, /const tip = \(event: PointerEvent\): void => \{\n\s*this\.owner\._showTip/);
});
