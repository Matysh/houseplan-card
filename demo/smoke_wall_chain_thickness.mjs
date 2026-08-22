/**
 * Issue #234: a chain stores the thickness it was drawn with.
 *
 * The defect: "thickness of segment i" was decided by six independent formulas
 * with three different fallbacks, so a chain drawn at 30 cm could be previewed
 * at 30 and written as 15. The check below builds a chain whose last segment has
 * no recorded thickness — the shape a mid-edit toolbar field used to produce —
 * and then reads three things that used to disagree: the committed partitions,
 * what the Thickness tool reports for the same stretch, and what a resumed
 * legacy draft carries. A missing live tail uses the current field; only an
 * internal historical gap inherits the preceding segment.
 */
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const upd = async () => { c._cfgEpoch++; c.requestUpdate(); await c.updateComplete; };
  const sp = () => c._serverCfg.spaces.find((s) => s.id === c._space);

  c._setMode('plan');
  c._tool = 'draw';
  await upd();

  const space = sp();
  const savedRooms = JSON.parse(JSON.stringify(space.rooms || []));
  const savedPartitions = JSON.parse(JSON.stringify(space.partitions || []));
  const savedDrafts = space.room_drafts ? JSON.parse(JSON.stringify(space.room_drafts)) : null;
  space.rooms = [];
  space.partitions = [];
  delete space.room_drafts;
  await upd();

  const g = c._gridPitch;
  const pts = [
    [100, 100],
    [100 + 6 * g, 100],
    [100 + 6 * g, 100 + 6 * g],
    [100 + 12 * g, 100 + 6 * g],
  ];

  // Two recorded segments at 30 and 25 cm, then a live third segment whose
  // record does not exist yet. The current field is 30 cm.
  c._drawWallField = '30';
  await upd();
  out.fieldAcceptedThirty = c._drawWallCm === 30;
  c._activeDraftId = null;
  c._path = [pts[0], pts[1], pts[2], pts[3]];
  c._draftSegmentCms = [30, 25];
  c._closingWallCm = null;
  await upd();

  // Preview and the writer must agree on that third segment.
  const previewD = (c.shadowRoot || c.renderRoot)
    ?.querySelector('path.drawwall-preview')?.getAttribute('d') || '';
  out.previewRendered = previewD.length > 0;

  out.committed = c._finishWallChain();
  await upd();
  const stored = (sp().partitions || []).map((p) => p.cm);
  out.storedThreeSegments = stored.length === 3;
  out.storedFirstThirty = stored[0] === 30;
  out.storedSecondTwentyFive = stored[1] === 25;
  // A live missing tail uses the current field, not the previous segment.
  out.liveTailUsesCurrentField = stored[2] === 30;
  out.nothingFellBackToFifteen = !stored.includes(15);

  // The Thickness tool reads the same value it stored: the mismatch between
  // highlight and record is how the defect was noticed in the first place.
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const path = [pts[0], pts[1], pts[2], pts[3]];
  const reported = [
    c._wallSourceCmAt(mid(pts[0], pts[1]), path, [30, 25]),
    c._wallSourceCmAt(mid(pts[1], pts[2]), path, [30, 25]),
    c._wallSourceCmAt(mid(pts[2], pts[3]), path, [30, 25]),
  ];
  out.highlightMatchesStored = reported[0] === stored[0]
    && reported[1] === stored[1] && reported[2] === stored[2];

  // A draft saved with fewer records than segments (data written before this
  // fix) resumes with a full vector instead of carrying a hidden 15 cm.
  space.partitions = [];
  space.room_drafts = [{
    id: 'legacy-234',
    points: pts.map((p) => [p[0] / 1000, p[1] / 1000]),
    segments: [{ cm: 30 }],
  }];
  c._resumeDraftBySpace[c._space] = 'legacy-234';
  c._path = [];
  c._draftSegmentCms = [];
  c._activeDraftId = null;
  await upd();
  c._resumeLastDraft();
  await upd();
  out.legacyResumedFullVector = c._draftSegmentCms.length === c._path.length - 1;
  out.legacyGapsInheritedThirty = c._draftSegmentCms.every((cm) => cm === 30);

  c._path = [];
  c._draftSegmentCms = [];
  c._activeDraftId = null;
  delete c._resumeDraftBySpace[c._space];
  space.rooms = savedRooms;
  space.partitions = savedPartitions;
  if (savedDrafts) space.room_drafts = savedDrafts; else delete space.room_drafts;
  await upd();
  return out;
});

checkAll(res);
await finish(browser);
