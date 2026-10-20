// Browser contract for active wall chains, independent partitions and columns.
// This deliberately exercises the card's editor transactions rather than
// injecting finished records: create, drag, edit and Delete must all pass
// through the same paths a pointer/keyboard gesture uses.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);

// #861 B-only migration: retain this scenario's existing observations while
// entering physical selection/movement through real browser input, not the
// private gesture owner's former fields. The page awaits this native bridge.
await page.exposeFunction('__physicalNativeInput', async ({ from, to, escape }) => {
  if (escape) { await page.keyboard.press('Escape'); return; }
  await page.mouse.move(from.x, from.y);
  if (!to) { await page.mouse.click(from.x, from.y); return; }
  await page.mouse.down();
  // Its historical target is only one grid step. Cross the real 5px drag
  // threshold first, then return to that exact target before releasing.
  if (Math.hypot(to.x - from.x, to.y - from.y) < 10) {
    await page.mouse.move(from.x + 30, from.y + 30, { steps: 6 });
  }
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
});

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const PITCH = 1000 / 240;
  const nativePhysical = async (from, to) => {
    await window.__hpTest.settled();
    // Config/dialog changes can still be fitting the SVG camera. Observe the
    // presented transform before choosing a native target; don't click where
    // its old screen coordinates happened to be while that fit was moving.
    let previous = '', stable = 0;
    const deadline = performance.now() + 5000;
    while (stable < 3) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const m = c.renderRoot.querySelector('.stage svg').getScreenCTM();
      const current = [m.a, m.b, m.c, m.d, m.e, m.f].join(',');
      stable = current === previous ? stable + 1 : 0;
      previous = current;
      if (performance.now() >= deadline) throw new Error('physical native fixture camera did not settle');
    }
    const svg = c.renderRoot.querySelector('.stage svg');
    const screen = (point) => {
      const p = new DOMPoint(...point).matrixTransform(svg.getScreenCTM());
      return { x: p.x, y: p.y };
    };
    await window.__physicalNativeInput({ from: screen(from), to: to && screen(to) });
    await c.updateComplete;
  };
  // A quarter point is on the solid body, outside endpoint-node hit targets
  // and outside the central hosted-opening gap used later in this scenario.
  const partitionPoint = (partition) => [0, 1].map(axis =>
    1000 * (partition.a[axis] + (partition.b[axis] - partition.a[axis]) * 0.25));
  // The product owns dangerous confirmations through hp-confirm now.  This
  // smoke covers geometry transactions, while smoke_danger_confirmation
  // exercises the real dialog; keep the decision deterministic here.
  // Exercise hp-dialog's HA branch without depending on the Home Assistant
  // frontend in the standalone demo.  The fixed one-line fallback below
  // reproduces ha-dialog-header's public custom-property contract: Houseplan
  // must explicitly opt into content-sized localized titles.
  if (!customElements.get('ha-dialog')) {
    customElements.define('ha-dialog', class extends HTMLElement {
      constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.innerHTML = `<style>
          :host { display:block; width:300px; }
          .surface { width:300px; box-sizing:border-box; overflow:hidden; }
          .mock-header { padding:8px; overflow:hidden; }
          .mock-title {
            height:var(--ha-dialog-header-title-height, 35px);
            overflow:hidden;
            font-size:28px;
            line-height:1.25;
          }
          .mock-footer { display:flex; width:100%; box-sizing:border-box; }
        </style>
        <div class="surface">
          <div class="mock-header"><div class="mock-title"><slot name="headerTitle"></slot></div></div>
          <slot></slot>
          <div class="mock-footer"><slot name="footer"></slot></div>
        </div>`;
      }
    });
  }
  c.hass = { ...c.hass, locale: { ...(c.hass.locale || {}), language: 'ru' } };
  c._serverCfg = {
    model_version: 10,
    spaces: [{ id: 'physical', title: 'Physical', cell_cm: 5,
      view_box: [0, 0, 1, 1], rooms: [], wall_segments: [] }],
    markers: [], settings: {},
  };
  c._space = 'physical';
  c._mode = 'plan';
  c._modelCache = null;
  // Keep the smoke local: editor transactions still mutate the real config,
  // invalidate derived models and history, but do not need a websocket write.
  c._saveConfig = () => { c._cfgEpoch++; c._modelCache = null; c.requestUpdate(); };
  c.requestUpdate();
  await c.updateComplete;
  // #627: ru strings of the editor dialogs are a lazy chunk; the switch to ru
  // above holds the previous frame (inert + aria-busy) until it settles.
  for (let i = 0; i < 250 && c.hasAttribute('aria-busy'); i++) await new Promise((r) => setTimeout(r, 20));
  await c.updateComplete;

  const stage = (c.shadowRoot || c.renderRoot).querySelector('.stage');
  const clickAt = (x, y) => {
    const rect = stage.getBoundingClientRect();
    const view = c._viewOr(c._baseVb());
    return new MouseEvent('click', {
      clientX: rect.left + ((x - view.x) / view.w) * rect.width,
      clientY: rect.top + ((y - view.y) / view.h) * rect.height,
      bubbles: true,
    });
  };
  const drawAndFinish = (a, b, cm) => {
    c._activateMarkupTool('draw');
    c._drawWallField = String(cm);
    c._markupClick(clickAt(...a));
    c._markupClick(clickAt(...b));
    c._activateMarkupTool('select');
  };

  drawAndFinish([100, 100], [300, 100], 15);
  let sp = c._serverCfg.spaces[0];
  o.partitionCreated = sp.partitions?.length === 1 && sp.partitions[0].cm === 15;

  c._tool = 'column';
  c._drawWallField = '30';
  c._columnClick([200, 200]);
  sp = c._serverCfg.spaces[0];
  o.columnCreatedSquare = sp.wall_columns?.length === 1
    && sp.wall_columns[0].shape === 'square' && sp.wall_columns[0].cm === 30;

  // Незавершённая цепочка сохраняется сразу обычной partition, вместе с
  // толщиной отрезка.
  // Путь набирается кликами, а не присваиванием `_path`: с #234 толщина
  // пишется в тот же момент, что и точка, и подстановка пути в обход клика
  // опирается на снятый там fallback — тест проверял бы поведение, которого
  // в продукте больше нет.
  c._activateMarkupTool('draw');
  c._drawWallField = '12';
  c._activeWallChainId = null;
  c._activeWallChainPartitionIds = [];
  c._markupClick(clickAt(100, 300));
  c._markupClick(clickAt(200, 300));
  o.wallChainRecordedThickness = c._wallChainSegmentCms.length === c._path.length - 1;
  sp = c._serverCfg.spaces[0];
  const activeWallId = c._activeWallChainPartitionIds[0];
  o.wallPersistedImmediately = !!activeWallId
    && sp.partitions?.some((item) => item.id === activeWallId && item.cm === 12);

  const part = c._spaceModel().partitions[0];
  await window.__hpTest.setTool('select');
  const from = [(part.a[0] + part.b[0]) / 2, (part.a[1] + part.b[1]) / 2];
  await nativePhysical(from, [from[0] + PITCH, from[1] + PITCH]);
  sp = c._serverCfg.spaces[0];
  o.partitionDragIsRigidAndGridBound = Math.abs(sp.partitions[0].a[0] - (0.1 + PITCH / 1000)) < 1e-9
    && Math.abs((sp.partitions[0].b[0] - sp.partitions[0].a[0]) - 0.2) < 1e-9
    && Math.abs(sp.partitions[0].a[1] - sp.partitions[0].b[1]) < 1e-9;

  const actionLayout = () => {
    const root = c.shadowRoot || c.renderRoot;
    const dialog = root.querySelector('hp-dialog');
    const footer = dialog?.querySelector('.physicalfooter');
    const danger = footer?.querySelector('.dialog-action-danger');
    const commit = footer?.querySelector('.dialog-action-commit');
    const footerRect = footer?.getBoundingClientRect();
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const innerLeft = footerRect && footerStyle
      ? footerRect.left + parseFloat(footerStyle.paddingLeft) : 0;
    const innerRight = footerRect && footerStyle
      ? footerRect.right - parseFloat(footerStyle.paddingRight) : 0;
    const buttons = [...(footer?.querySelectorAll('button') || [])];
    return {
      dialog, footer, danger, commit, footerRect, innerLeft, innerRight, buttons,
      contained: !!footerRect && buttons.every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left >= innerLeft - 1 && rect.right <= innerRight + 1
          && rect.top >= footerRect.top - 1 && rect.bottom <= footerRect.bottom + 1;
      }),
    };
  };

  c._openPhysicalDialog('partition', sp.partitions[0].id);
  await c.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const partitionLayout = actionLayout();
  const haDialog = partitionLayout.dialog?.shadowRoot?.querySelector('ha-dialog');
  const title = partitionLayout.dialog?.shadowRoot?.querySelector('.title-text');
  const mockTitle = haDialog?.shadowRoot?.querySelector('.mock-title');
  const titleRect = title?.getBoundingClientRect();
  const mockTitleRect = mockTitle?.getBoundingClientRect();
  const dangerRect = partitionLayout.danger?.getBoundingClientRect();
  const commitRect = partitionLayout.commit?.getBoundingClientRect();
  o.physicalTitleWrapsAndIsContained = !!titleRect && !!mockTitleRect
    && titleRect.height > 35
    && titleRect.top >= mockTitleRect.top - 1
    && titleRect.bottom <= mockTitleRect.bottom + 1;
  o.partitionFooterActionsContained = partitionLayout.contained
    && partitionLayout.buttons.length === 3;
  o.partitionFooterGroupsWrapCleanly = !!dangerRect && !!commitRect
    && commitRect.top >= dangerRect.bottom - 1
    && Math.abs(commitRect.right - partitionLayout.innerRight) <= 1;
  o.partitionFooterTouchTargets = partitionLayout.buttons.every((button) =>
    button.getBoundingClientRect().height >= 44);
  await window.__physicalNativeInput({ escape: true });
  await c.updateComplete;

  const partitionId = sp.partitions[0].id;
  sp.openings = [{
    id: 'hosted-opening', type: 'door', width_cm: 90,
    host: { kind: 'partition', id: partitionId, t: 0.5 },
  }];
  c.requestUpdate(); await c.updateComplete;
  await nativePhysical(partitionPoint(sp.partitions.find(partition => partition.id === partitionId)));
  const hostedDelete = c._deletePhysicalSelection();
  o.hostedPartitionDeleteReturnsPromise = typeof hostedDelete?.then === 'function';
  await hostedDelete;
  o.hostedPartitionWaitsForDecision = !!c._partitionDeleteDialog
    && c._serverCfg.spaces[0].partitions?.some((partition) => partition.id === partitionId);
  c._partitionDeleteDialog = null;
  delete sp.openings;

  await nativePhysical(partitionPoint(sp.partitions.find(partition => partition.id === partitionId)));
  const partitionDelete = c._deletePhysicalSelection();
  o.partitionDeleteReturnsPromise = typeof partitionDelete?.then === 'function';
  await partitionDelete;
  o.deleteRemovesOnlySelectedPartition = !c._serverCfg.spaces[0].partitions
    ?.some((partition) => partition.id === partitionId)
    && c._serverCfg.spaces[0].partitions?.some((partition) => partition.id === activeWallId);

  const columnId = c._serverCfg.spaces[0].wall_columns[0].id;
  const column = c._serverCfg.spaces[0].wall_columns.find(item => item.id === columnId);
  await nativePhysical(column.center.map(value => value * 1000));
  const columnDelete = c._deletePhysicalSelection();
  o.columnDeleteReturnsPromise = typeof columnDelete?.then === 'function';
  await columnDelete;
  o.deleteRemovesColumn = !c._serverCfg.spaces[0].wall_columns;

  const stageRect = stage.getBoundingClientRect();
  await window.__physicalNativeInput({ from: { x: stageRect.right - 10, y: stageRect.bottom - 10 } });
  const emptyDelete = c._deletePhysicalSelection();
  o.emptyDeleteReturnsPromise = typeof emptyDelete?.then === 'function';
  await emptyDelete;

  const beforeInvalid = c._serverCfg.spaces[0].partitions?.length || 0;
  drawAndFinish([400, 100], [500, 100], 120);
  o.invalidThicknessCreatesNothing = (c._serverCfg.spaces[0].partitions?.length || 0)
    === beforeInvalid;

  return o;
});

await finish(browser, checkAll(out));
