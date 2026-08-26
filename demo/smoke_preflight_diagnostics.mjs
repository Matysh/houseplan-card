/**
 * Issue #295: a failed optimize preflight names the reason per space, offers
 * a copyable diagnostics block (with an inline fallback when the clipboard is
 * unavailable), logs one structured dev record, and only advises updating
 * when the integration version actually differs.
 */
import { launch, check, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 900 }, 1);

const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  card._serverCfg = { spaces: [{ id: 'bad', title: 'Bad space', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'r', name: 'R', area: null, poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.4], [0.1, 0.4]] }],
  }], markers: [], settings: {} };
  card._layout = {}; card._space = 'bad'; card._modelCache = null; card._frame = null;
  card._cfgEpoch++; card._setMode('plan'); await update();

  const result = {};
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...args) => { warns.push(args); origWarn(...args); };

  // Failed preflight, one failure per reason path we care about
  const preflight = {
    fingerprint: 'fp-1',
    spaces: [], ok: false,
    failures: [
      { spaceId: 'bad', displayName: 'Bad space', status: 'failed', reason: 'wall-exception', detail: 'Error' },
      { spaceId: 'bad2', displayName: 'Second', status: 'failed', reason: 'floor-null' },
    ],
  };
  card._reportPreflightFailure(preflight);
  card._reportPreflightFailure(preflight); // dedup: same fingerprint logs once
  result.devLogOnce = warns.filter((w) => String(w[0]).includes('optimize preflight failed')).length === 1;
  const logged = warns.find((w) => String(w[0]).includes('optimize preflight failed'))?.[1];
  result.devLogShape = !!logged && logged.kind === 'houseplan-optimize-preflight'
    && logged.origin === 'runtime' && Array.isArray(logged.failures)
    && logged.failures[0].reason === 'wall-exception' && logged.failures[0].detail === 'Error'
    && typeof logged.preflightFingerprint === 'string' && typeof logged.checkedAt === 'string';

  // Dialog: failed branch renders per-failure reasons. The dialog carries the
  // CANDIDATE config the preflight judged — its geometry differs from the
  // saved one, exactly like a real refused optimize run (r.changed === true).
  const candidateCfg = structuredClone(card._serverCfg);
  candidateCfg.spaces[0].rooms[0].poly = [[0.1, 0.1], [0.6, 0.1], [0.6, 0.4], [0.1, 0.4]];
  card._alignDialog = {
    cm: 5, where: '', changed: true, busy: false, removeLiveMissingPositions: false,
    preflight,
    config: candidateCfg, layout: {},
    report: { moved: 0, total: 0, rotated: 0, removedDrafts: 0, migrated: 0, canonicalized: 0,
      coordsCanonicalized: 0, latticeCoordinatesCanonicalized: 0, wallSegmentsMigrated: 0,
      wallsMerged: 0, spansMerged: 0, partitionsMerged: 0, partitionsReconciled: 0,
      openingsRehosted: 0, redundantDraftsRemoved: 0, wallsStraightened: 0,
      maxStraightenShiftCm: 0, maxStraightenSpace: '', spaceRefsRemapped: 0, roomRefsRemapped: 0,
      positionsRemapped: 0, markersDetached: 0, orphanRoomLabelsRemoved: 0,
      orphanDevicePositionsRemoved: 0, orphanGroupPositionsRemoved: 0,
      removedPositions: [], liveMissingPositions: [], unverifiedPositions: [],
      nestedRefsUnresolved: 0 },
  };
  await update();
  const dialogText = root().querySelector('hp-dialog')?.textContent || '';
  result.reasonShown = dialogText.includes(card._t('gs.preflight_reason_wall-exception'))
    && dialogText.includes(card._t('gs.preflight_reason_floor-null'));
  result.spaceNamed = dialogText.includes('Bad space') && dialogText.includes('Second');
  result.copyButton = dialogText.includes(card._t('gs.preflight_copy'));
  // Same versions -> no «update» advice; differing -> shown
  result.noUpdateHintSameVersion = !dialogText.includes(card._t('gs.preflight_update_hint'));
  card._haIntegrationVersion = '0.0.1-other'; await update();
  const withHint = root().querySelector('hp-dialog')?.textContent || '';
  result.updateHintOnDiff = withHint.includes(card._t('gs.preflight_update_hint'));
  card._haIntegrationVersion = null; await update();

  // Copy: clipboard success path
  let copied = null;
  const clipboard = { writeText: async (text) => { copied = text; } };
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
  await card._copyPreflightDiagnostics(); await update();
  let block = null;
  try { block = JSON.parse(copied); } catch { /* keep null */ }
  result.copiedBlock = !!block && block.kind === 'houseplan-optimize-preflight'
    && block.origin === 'runtime' && block.failures.length === 2
    && block.failures[0].reason === 'wall-exception' && block.failures[1].detail === null;

  // CODE-REVIEW-295-r1 M1: the geometry hash comes from the candidate the
  // preflight judged, not from the saved config — the block must carry what
  // a space export cannot reproduce.
  const candidateHash = block.failures[0].spaceGeometryFingerprint;
  const saved = card._alignDialog;
  card._alignDialog = { ...saved, config: card._serverCfg };
  copied = null;
  await card._copyPreflightDiagnostics(); await update();
  const savedHash = JSON.parse(copied).failures[0].spaceGeometryFingerprint;
  card._alignDialog = saved; await update();
  result.fingerprintTracksCandidate = typeof candidateHash === 'string'
    && candidateHash.length > 0 && candidateHash !== savedHash;

  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });

  // Copy: clipboard failure -> inline fallback with the same JSON
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => { throw new Error('denied'); } }, configurable: true,
  });
  await card._copyPreflightDiagnostics(); await update();
  const pre = root().querySelector('hp-dialog details pre');
  result.inlineFallback = !!pre && pre.textContent.includes('houseplan-optimize-preflight');

  // CODE-REVIEW-295-r1 M2: the inline fallback belongs to one dialog showing.
  // Closing through the real hp-close path clears it, so a later refusal can
  // never exhibit the previous refusal's JSON.
  root().querySelector('hp-dialog')?.dispatchEvent(new CustomEvent(
    'hp-close', { bubbles: true, composed: true },
  ));
  await update();
  result.fallbackClearedOnClose = card._alignDialog === null
    && card._preflightClipboardFallback === null;

  console.warn = origWarn;
  return result;
});

checkAll(out);
await finish(browser);
