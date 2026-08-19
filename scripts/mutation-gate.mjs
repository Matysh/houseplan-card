#!/usr/bin/env node
// Реестр известных поломок (mutation gate), issue #85.
//
//   node scripts/mutation-gate.mjs --list          мутанты и кого они проверяют
//   node scripts/mutation-gate.mjs --check         патчи применимы к текущему коду
//   node scripts/mutation-gate.mjs                 полный прогон: все мутанты
//   node scripts/mutation-gate.mjs --id=<mutant>   один мутант
//   node scripts/mutation-gate.mjs --build-only    применить и собрать, тест не гонять
//
// Код выхода: 0 — каждый тест поймал свою поломку, 1 — хотя бы один не поймал,
// 2 — не смог проверить (патч не лёг, сборка упала).
//
// Зачем. Зелёный тест в этом проекте несколько раз означал «ничего не
// проверено», и выяснялось это после того, как баг доезжал до владельца:
// смок непрерывности не заметил удаления механизма, который защищает; golden,
// заведённый под #71, был пуст — 1 177 тёплых пикселей против 107 119, и все
// 1 177 были иконками. Общее у всех случаев: тест ни разу не проверяли на
// способность падать. Этот гейт делает такую проверку регулярной.
//
// Каждый мутант — маленький патч продуктового исходника, воспроизводящий
// известную поломку, и имя теста, который ОБЯЗАН на ней покраснеть. Прогон:
// worktree → патч → сборка бандла → бандл в demo/srv/assets → тест. Тест,
// оставшийся зелёным, — это провал гейта, а не успех теста.
//
// Прогон дорогой (пересборка бандла на мутанта), поэтому его место — перед
// стабильным релизом (.github/workflows/mutation-gate.yml), не на каждой бете.
// Дешёвая часть — «патчи применимы, guard-файлы существуют» — живёт в
// test/mutation-gate.test.mjs и идёт с обычными юнитами: реестр, отставший от
// кода, хуже отсутствующего, потому что выглядит защитой.

import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- реестр ---------------------------------------------------------------
// `find` обязан встречаться в файле ровно один раз: патч, который ложится «куда
// попало», проверяет не то, что объявлен проверять. Это контролирует --check.
export const MUTANTS = [
  {
    id: 'stale-space-position-guard-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="stable space ids" test/optional-space-model-contract.test.mjs',
    because: 'position persistence with a stable space id must fail closed before layout, dirty-set '
      + 'and websocket side effects when that space has been deleted or renamed',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (!this._spaceModelById(d.space)) return;\n    if (this._norm) {',
      replace: '    if (this._norm) {',
    }],
  },
  {
    id: 'empty-space-cleanup-disabled',
    guard: 'node demo/smoke_optional_space_model.mjs',
    because: 'удаление последнего пространства обязано завершать жесты, редакторы и отложенную запись; '
      + 'смок дважды переводит живую карточку в пустой план и проверяет реальный lifecycle cleanup',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'if (this._emptySpaceStateActive) return;',
      replace: 'if (empty) return;',
    }],
  },
  {
    id: 'continuity-long-resume-noop',
    guard: 'node demo/smoke_visual_continuity.mjs',
    because: 'смок обязан доказывать, что long-resume СРАБОТАЛ (токен ушёл вперёд), '
      + 'а не что ничего не спрятали: в beta.7 он не заметил удаления всего механизма',
    patches: [{
      file: 'src/visual-continuity.ts',
      find: "if (!signal.long && (signal.kind === 'visible' || signal.kind === 'pageshow')) {",
      replace: "if ((signal.kind === 'visible' || signal.kind === 'pageshow')) {",
    }],
  },
  {
    id: 'opening-cut-degenerate',
    guard: 'node demo/smoke_glow.mjs',
    because: 'проём, выродившийся в точку, остаётся кладкой — свет перестаёт '
      + 'проходить через дверь; смок обязан это увидеть по освещённому полу за проёмом',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'cuts.push([opening.x - dx, opening.y - dy, opening.x + dx, opening.y + dy]);',
      replace: 'cuts.push([opening.x, opening.y, opening.x, opening.y]);',
    }],
  },
  {
    id: 'registryless-opening-requires-registry-row',
    guard: 'node demo/smoke_registryless_opening.mjs',
    because: 'возврат требования Entity Registry row снова делает выбранную YAML-сущность '
      + 'невидимой в painted frame; smoke обязан доказать contact, lock и frozen-snapshot parity',
    patches: [{
      file: 'src/ha-binding-status.ts',
      find: '  return !!entityId\n    && !!projectedHass?.states?.[entityId];',
      replace: '  return !!entityId\n    && !!projectedHass?.entities?.[entityId]\n'
        + '    && !!projectedHass?.states?.[entityId];',
    }],
  },
  {
    id: 'column-shadow-removed',
    guard: 'node demo/smoke_glow.mjs',
    because: 'физические тела выпали из окклюдеров — колонна перестаёт отбрасывать '
      + 'тень; исторически смок теней был зелёным, пока тени физически не рисовались',
    patches: [{
      file: 'src/houseplan-card.ts',
      // Physical bodies now enter the canonical masonry union. Mutating only
      // its legacy fallback is a no-op on every valid thick-wall fixture.
      find: 'this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W, lightPhysical,',
      replace: 'this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W, [],',
    }],
  },
  {
    id: 'feather-20px',
    guard: 'node demo/smoke_glow.mjs',
    because: 'растушёвка 20 px вместо 2 размывает границу света на полкомнаты; '
      + 'смок читает data-feather-px и обязан отвергнуть значение больше 3',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'const GLOW_EDGE_FEATHER_PX = 2;',
      replace: 'const GLOW_EDGE_FEATHER_PX = 20;',
    }],
  },
  {
    id: 'barrier-cache-never-invalidated',
    guard: 'node demo/smoke_openwall.mjs',
    because: 'кэш барьеров, который не инвалидируется по содержимому, — это свет '
      + 'сквозь стену, которая уже существует; смок переключает виртуальную границу '
      + 'и обязан увидеть смену освещённости соседней комнаты',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'if (this._lightBarrierCache?.key === cacheKey) return this._lightBarrierCache.value;',
      replace: 'if (this._lightBarrierCache) return this._lightBarrierCache.value;',
    }],
  },
  {
    id: 'golden-lamp-out-of-reach',
    guard: 'node demo/golden/run.mjs --mode=capture --scenario=lighting-opaque-glow-two-doorways-dark',
    because: 'сцена заведена как защита дверного света (#71) и однажды уже была '
      + 'пустой: лампа стояла так, что пятно не доходило до стены. Уведённая лампа '
      + 'обязана ронять семантический ассерт warmPixelRegion, а не только пиксельный дифф. '
      + 'Режим capture, а не verify: политика запрещает verify по одной сцене '
      + '(demo/golden/policy.mjs) — частичный verify это лазейка «чтобы CI позеленел». '
      + 'На capture семантический провал даёт status error, и goldenRunFailed '
      + 'краснеет в любом режиме — то есть проверка сохраняется полностью',
    // Мутируется фикстура сцены, не продуктовый код: пустота сцены — свойство
    // фикстуры. Пересборка бандла всё равно нужна, путь тот же.
    patches: [{
      file: 'demo/golden/matrix.mjs',
      find: "layoutOverrides: { 'golden-light-one': { s: 'golden-lighting', x: 0.40, y: 0.48 } },",
      replace: "layoutOverrides: { 'golden-light-one': { s: 'golden-lighting', x: 0.06, y: 0.90 } },",
    }],
  },
  {
    id: 'golden-filled-tunnel-removed',
    guard: 'node demo/golden/run.mjs --mode=capture --scenario=openings-filled-tunnel-dark',
    because: 'сцена защищает непрерывную room-coloured заливку толстого тоннеля (#81): '
      + 'если fixture перестаёт рисовать заливку, semantic tunnelContinuity обязан упасть, '
      + 'а не принять пустой проём как корректный golden',
    // Ломаем только заявленное условие fixture. Capture сохраняет полный
    // semantic gate даже для одной сцены и не зависит от pixel baseline.
    patches: [{
      file: 'demo/golden/matrix.mjs',
      find: "{ id: 'openings-filled-tunnel-dark', fixture: 'visual', space: 'golden-lighting', mode: 'view',\n    fillMode: 'custom', customFill: { c: '#66717c', a: 0.55 }, glowEnabled: false,",
      replace: "{ id: 'openings-filled-tunnel-dark', fixture: 'visual', space: 'golden-lighting', mode: 'view',\n    fillMode: 'none', customFill: { c: '#66717c', a: 0.55 }, glowEnabled: false,",
    }],
  },
  {
    id: 'sun-north-subtraction-restored',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="planSunAngle" test/sun.test.mjs',
    because: 'возврат старого azimuth - northDeg снова зеркалит направление при '
      + 'ненулевом севере; табличный AC-01 обязан покраснеть на 90+90 и wrap-кейсах',
    patches: [{
      file: 'src/sun.ts',
      find: 'return norm360(azimuth + northDeg);',
      replace: 'return norm360(azimuth - northDeg);',
    }],
  },
  {
    id: 'sun-to-sun-vector-inverted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="north right plus east sun" test/sun.test.mjs',
    because: 'формула угла остаётся правильной, но инверсия toSun выбирает окно с '
      + 'противоположной стороны; направленный AC-03 обязан отличить окно от направления луча',
    patches: [{
      file: 'src/sun.ts',
      find: '  const toSun = sunDirOnPlan(azimuth, northDeg);\n  const away: [number, number] = [-toSun[0], -toSun[1]];',
      replace: '  const direction = sunDirOnPlan(azimuth, northDeg);\n  const toSun: [number, number] = [-direction[0], -direction[1]];\n  const away: [number, number] = [-toSun[0], -toSun[1]];',
    }],
  },
  {
    id: 'sun-golden-north-neutralized',
    guard: 'node --test --test-name-pattern="sun-ray golden" test/golden-matrix.test.mjs',
    because: 'нулевой north_deg снова делает golden нечувствительным к знаку композиции; '
      + 'структурный тест обязан требовать ненулевой север и асимметричный азимут',
    patches: [{
      file: 'demo/golden/matrix.mjs',
      find: '    glowEnabled: false, allLightsOff: true, northDeg: 90,',
      replace: '    glowEnabled: false, allLightsOff: true, northDeg: 0,',
    }],
  },
  {
    id: 'plan-only-room-area-restored',
    guard: 'node scripts/backend-test-guard.mjs plan_only_export_projects',
    because: 'возврат room.area нарушает основное обещание чистого шаблона; '
      + 'projection/roundtrip тест обязан увидеть HA Area даже при нулевых markers',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '_ROOM_PLAN_FIELDS = ("id", "name", "open_to", "x", "y", "w", "h", "poly")',
      replace: '_ROOM_PLAN_FIELDS = ("id", "name", "area", "open_to", "x", "y", "w", "h", "poly")',
    }],
  },
  {
    id: 'plan-only-projector-bypassed',
    guard: 'node scripts/backend-test-guard.mjs plan_only_export_projects',
    because: 'игнорирование request-флага возвращает markers и device layout; '
      + 'полный representative export обязан доказать, что true включает lossy projector',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '        if plan_only:\n            projected_space = _project_plan_only_space(space)',
      replace: '        if False and plan_only:\n            projected_space = _project_plan_only_space(space)',
    }],
  },
  {
    id: 'ordinary-export-plan-only-false-emitted',
    guard: 'node scripts/backend-test-guard.mjs ordinary_space_export_is_unchanged',
    because: 'аддитивное поле не должно менять обычный space export даже значением false; '
      + 'fixed regression обязан сохранить прежнюю структуру документа',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '**({"plan_only": True} if plan_only else {}),',
      replace: '**({"plan_only": plan_only}),',
    }],
  },
  {
    id: 'plan-only-revalidate-flag-dropped',
    guard: 'node scripts/backend-test-guard.mjs plan_only_export_projects',
    because: 'revalidate не имеет права превращать plan-only preview в обычный space preview; '
      + 'roundtrip test проверяет сохранение флага после обновления revisions',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '            "plan_only": _transfer_plan_only(document),\n            "counts":',
      replace: '            "plan_only": False,\n            "counts":',
    }],
  },
  {
    id: 'plan-only-forged-file-trusted',
    guard: 'node scripts/backend-test-guard.mjs forged_plan_only_privacy_claim',
    because: 'флаг файла не является доказательством приватности; negative parser matrix '
      + 'обязана покраснеть, если schema-aware проверка больше не вызывается',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '    if plan_only:\n        _validate_plan_only_document(document, config, layout, placement)',
      replace: '    if False and plan_only:\n        _validate_plan_only_document(document, config, layout, placement)',
    }],
  },
  {
    id: 'plan-only-preview-label-hidden',
    guard: 'node demo/smoke_backup_transfer.mjs',
    because: 'валидный plan-only файл без явной строки в preview выглядит обычной копией; '
      + 'browser smoke обязан проверять пользовательский статус, а не только backend-флаг',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "${p.plan_only ? html`<span class=\"backupplanonlystatus\">${this._t('backup.plan_only_preview')}</span>` : nothing}",
      replace: "${false ? html`<span class=\"backupplanonlystatus\">${this._t('backup.plan_only_preview')}</span>` : nothing}",
    }],
  },
  {
    id: 'passage-visible-geometry-door-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/opening-symbol.test.mjs',
    because: 'если явную пустую ветку passage убрать, общий fallback рисует дверную створку; '
      + 'renderer test обязан требовать буквально пустую видимую геометрию',
    patches: [{
      file: 'src/render/opening-symbol.ts',
      find: "  if (spec.type === 'passage') return svg``;",
      replace: "  if (false && spec.type === 'passage') return svg``;",
    }],
  },
  {
    id: 'passage-light-classifier-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/light-visibility.test.mjs',
    because: 'потеря passage из явного allowlist снова делает внутренний открытый проём '
      + 'непрозрачным; тест одновременно сохраняет fail-dark для неизвестных типов',
    patches: [{
      file: 'src/logic.ts',
      find: "  return type === 'door' || type === 'gate' || type === 'passage';",
      replace: "  return type === 'door' || type === 'gate';",
    }],
  },
  {
    id: 'passage-import-validator-bypassed',
    guard: 'node scripts/backend-test-guard.mjs invalid_passage_import',
    because: 'импорт является недоверенным новым content и не имеет broken-read исключения; '
      + 'forged contact/lock обязан быть отклонён до создания preview',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '        validate_opening_passages(incoming_config, validate_all=True)',
      replace: '        if False:\n            validate_opening_passages(incoming_config, validate_all=True)',
    }],
  },
  {
    id: 'passage-static-door-cut-leak',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/space-geometry.test.mjs',
    because: 'Static обязан менять masonry только для нового passage; добавление обычной двери '
      + 'в cuts сломает сохранённую совместимость старых планов',
    patches: [{
      file: 'src/space-geometry.ts',
      find: "    if (opening?.type !== 'passage') continue;",
      replace: "    if (opening?.type !== 'passage' && opening?.type !== 'door') continue;",
    }],
  },
  {
    id: 'passage-iso-door-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/iso-openings.test.mjs',
    because: 'без zero-leaf branch скрытая изометрия превращает passage в дверь; '
      + 'basis test обязан ловить любое появление панели независимо от live state',
    patches: [{
      file: 'src/iso-openings.ts',
      find: "  if (input.type === 'passage') {",
      replace: "  if (false && input.type === 'passage') {",
    }],
  },
  {
    id: 'manual-room-device-area-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="manual room without area.*device" test/devices.test.mjs',
    because: 'возврат старого device fallback снова даёт registry Area приоритет над явно '
      + 'сохранённой комнатой без HA Area; AC1 обязан увидеть неверные area и space',
    patches: [{
      file: 'src/devices.ts',
      find: '      const { area, space } = resolveExplicitMarkerPlacement(\n'
        + '        m, dev?.area_id, areaToSpace, firstSpaceId,\n'
        + '      );',
      replace: "      const area = m.area || dev?.area_id || '';\n"
        + '      const space = (area && areaToSpace[area]) || m.space || firstSpaceId;',
    }],
  },
  {
    id: 'manual-room-entity-branch-skipped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="manual room without area.*entity" test/devices.test.mjs',
    because: 'исправление только device-ветки оставляет entity Area и Area родительского '
      + 'устройства способными увести маркер из ручной комнаты; AC2 покрывает оба пути',
    patches: [{
      file: 'src/devices.ts',
      find: '      const { area, space } = resolveExplicitMarkerPlacement(\n'
        + '        m, registryArea, areaToSpace, firstSpaceId,\n'
        + '      );',
      replace: "      const area = m.area || registryArea || '';\n"
        + '      const space = (area && areaToSpace[area]) || m.space || firstSpaceId;',
    }],
  },
  {
    id: 'area-null-without-room-id-hijacked',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="area null without room_id" test/devices.test.mjs',
    because: 'одно area:null не доказывает ручную комнату: расширенный предикат угоняет '
      + 'legacy marker без room_id из registry Area; негативный AC3 обязан это поймать',
    patches: [{
      file: 'src/devices.ts',
      find: "  const manualRoomWithoutArea = typeof marker.room_id === 'string'\n"
        + '    && marker.room_id.length > 0\n'
        + '    && marker.area === null;',
      replace: '  const manualRoomWithoutArea = marker.area === null;',
    }],
  },
  {
    id: 'reopened-room-from-registry-space',
    guard: 'node demo/smoke_subarea.mjs',
    because: 'room_id без правильного effective space создаёт отсутствующую option при '
      + 'повторном открытии; browser smoke обязан восстановить точный garden#@room id',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "          ? d.space + '#@' + d.marker.room_id",
      replace: "          ? this._space + '#@' + d.marker.room_id",
    }],
  },
  {
    id: 'same-space-room-change-recenters',
    guard: 'node demo/smoke_subarea.mjs',
    because: 'редактирование комнаты внутри одного пространства не должно двигать уже '
      + 'расставленный маркер; smoke сравнивает закреплённые координаты до и после Save',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      if (!replacingRemoved && prevPos && prevPos.s === targetSpaceId) {',
      replace: '      if (!replacingRemoved && prevPos && prevPos.s === targetSpaceId && !roomChanged) {',
    }],
  },
  {
    id: 'plan-room-area-icon-hidden',
    guard: 'node demo/smoke_room_link.mjs',
    because: 'Plan обязан сохранять тот же состав name-row, что и View; возврат прежнего '
      + 'условия снова убирает Area icon и сдвигает подпись относительно anchor',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const showAreaLink = !!r.area;',
      replace: '    const showAreaLink = !this._markup && !!r.area;',
    }],
  },
  {
    id: 'plan-room-area-icon-navigates',
    guard: 'node demo/smoke_room_link.mjs',
    because: 'Area icon в Plan является частью drag-зоны, а не ссылкой; включение View-handlers '
      + 'обязано одновременно проявиться навигацией и невозможностью начать drag с иконки',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const areaLinkInteractive = !this._markup;',
      replace: '    const areaLinkInteractive = true;',
    }],
  },
];

// --- механика ---------------------------------------------------------------
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export function applyPatches(root, patches) {
  for (const patch of patches) {
    const path = join(root, patch.file);
    const source = readFileSync(path, 'utf8');
    const hits = source.split(patch.find).length - 1;
    if (hits !== 1) {
      throw new Error(`${patch.file}: якорь найден ${hits} раз(а), нужен ровно 1 — реестр отстал от кода`);
    }
    writeFileSync(path, source.replace(patch.find, patch.replace));
  }
}

function sh(cmd, cwd, extraEnv = {}) {
  return spawnSync(cmd, {
    cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  });
}

function makeWorktree() {
  const dir = mkdtempSync(join(tmpdir(), 'hp-mutant-'));
  const added = spawnSync('git', ['-C', repoRoot, 'worktree', 'add', '--detach', dir, 'HEAD'],
    { encoding: 'utf8' });
  if (added.status !== 0) throw new Error(`git worktree add: ${added.stderr}`);
  // node_modules не копируется — символическая ссылка на настоящий. Установка
  // зависимостей на каждого мутанта превратила бы вечерний гейт в суточный.
  symlinkSync(join(repoRoot, 'node_modules'), join(dir, 'node_modules'), 'junction');
  return dir;
}

function dropWorktree(dir) {
  spawnSync('git', ['-C', repoRoot, 'worktree', 'remove', '--force', dir], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
}

function buildBundle(dir) {
  // Только rollup, без tsc --noEmit: мутант имеет право быть нестрогим по
  // типам — он воспроизводит поломку, а не образцовый код.
  const built = sh('npx rollup -c', dir);
  if (built.status !== 0) {
    throw new Error(`сборка мутанта упала:\n${(built.stderr || built.stdout).slice(-2000)}`);
  }
  cpSync(join(dir, 'dist', 'houseplan-card.js'), join(dir, 'demo', 'srv', 'assets', 'houseplan-card.js'));
}

function runMutant(mutant) {
  const dir = makeWorktree();
  try {
    applyPatches(dir, mutant.patches);
    buildBundle(dir);
    const guard = sh(mutant.guard, dir);
    if (guard.status === 0) {
      console.log(`FAIL ${mutant.id}: тест остался зелёным на сломанном коде`);
      console.log(`     guard: ${mutant.guard}`);
      console.log(`     ${mutant.because}`);
      return false;
    }
    console.log(`ok   ${mutant.id}: тест покраснел, как обязан`);
    return true;
  } finally {
    dropWorktree(dir);
  }
}

// Чистый прогон каждого guard ровно один раз: тест, красный и без мутанта,
// «ловит» поломку тривиально и не доказывает ничего.
function runCleanGuards(mutants) {
  const guards = [...new Set(mutants.map((m) => m.guard))];
  const dir = makeWorktree();
  try {
    buildBundle(dir);
    for (const guard of guards) {
      const result = sh(guard, dir);
      if (result.status !== 0) {
        console.log(`FAIL чистый прогон: ${guard} красный без мутанта`);
        console.log((result.stderr || result.stdout).slice(-1500));
        return false;
      }
      console.log(`ok   чистый прогон: ${guard}`);
    }
    return true;
  } finally {
    dropWorktree(dir);
  }
}

function main(argv) {
  const idArg = argv.find((a) => a.startsWith('--id='))?.slice(5);
  const selected = idArg ? MUTANTS.filter((m) => m.id === idArg) : MUTANTS;
  if (idArg && !selected.length) {
    console.error(`мутант «${idArg}» не объявлен; --list покажет реестр`);
    return 2;
  }

  if (argv.includes('--list')) {
    for (const m of MUTANTS) console.log(`${m.id}\n  guard: ${m.guard}\n  ${m.because}\n`);
    return 0;
  }

  if (argv.includes('--check')) {
    let stale = 0;
    for (const m of selected) {
      try {
        for (const patch of m.patches) {
          const source = readFileSync(join(repoRoot, patch.file), 'utf8');
          const hits = source.split(patch.find).length - 1;
          if (hits !== 1) throw new Error(`якорь найден ${hits} раз(а)`);
        }
        console.log(`ok   ${m.id}`);
      } catch (error) {
        console.log(`FAIL ${m.id}: ${error.message}`);
        stale++;
      }
    }
    return stale ? 2 : 0;
  }

  if (argv.includes('--build-only')) {
    for (const m of selected) {
      const dir = makeWorktree();
      try {
        applyPatches(dir, m.patches);
        buildBundle(dir);
        console.log(`ok   ${m.id}: патч лёг, бандл собрался`);
      } catch (error) {
        console.log(`FAIL ${m.id}: ${error.message}`);
        return 2;
      } finally {
        dropWorktree(dir);
      }
    }
    return 0;
  }

  if (!runCleanGuards(selected)) return 2;
  let caught = 0;
  for (const m of selected) if (runMutant(m)) caught++;
  console.log(`\nпоймано ${caught} из ${selected.length}`);
  return caught === selected.length ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
