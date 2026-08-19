import { launch, checkAll, finish } from './serve.mjs';

const checks = {};
const geometry = [];

for (const scale of [1, 2]) {
  const { page, browser } = await launch({ width: 820, height: 760 }, scale);
  for (const dark of [false, true]) {
    const key = `dpr${scale}-${dark ? 'dark' : 'light'}`;
    const setup = await page.evaluate(async ({ dark }) => {
      const c = window.__card;
      const sr = () => c.shadowRoot || c.renderRoot;
      const settle = async () => {
        c.requestUpdate();
        await c.updateComplete;
        const deadline = performance.now() + 2000;
        while (c._modeTransitionBusy && performance.now() < deadline)
          await new Promise((resolve) => setTimeout(resolve, 20));
        await c.updateComplete;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      };
      const labelById = (id) => [...sr().querySelectorAll('.roomlabel')]
        .find((label) => label.dataset.id === id);
      const relativeBox = (label, selector) => {
        const anchorBox = label.getBoundingClientRect();
        const box = label.querySelector(selector)?.getBoundingClientRect();
        if (!box) return null;
        const anchorX = anchorBox.left + anchorBox.width / 2;
        const anchorY = anchorBox.top + anchorBox.height / 2;
        return {
          left: box.left - anchorX,
          top: box.top - anchorY,
          width: box.width,
          height: box.height,
        };
      };
      const snapshot = (label) => ({
        name: relativeBox(label, '.rlname'),
        metrics: relativeBox(label, '.rlmetrics'),
        metricsText: label.querySelector('.rlmetrics')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      });

      c.hass = {
        ...c.hass,
        themes: { ...(c.hass.themes || {}), darkMode: dark },
      };
      c._serverCfg = {
        ...c._serverCfg,
        spaces: c._serverCfg.spaces.map((space) => space.id !== c._space ? space : ({
          ...space,
          settings: {
            ...(space.settings || {}),
            show_names: true,
            label_temp: true,
            label_hum: true,
            label_lqi: true,
            label_light: true,
          },
        })),
      };
      const targetRoom = c._spaceModel().rooms.find((room) => room.name && room.area);
      if (targetRoom?.id) {
        c._layout = {
          ...c._layout,
          [`rl_${targetRoom.id}`]: { s: c._space, x: 0.16, y: 0.22 },
        };
      }
      c._setMode('view');
      await settle();

      const labels = [...sr().querySelectorAll('.roomlabel')];
      const label = labels.find((candidate) => candidate.querySelector('.rlgo')
        && candidate.querySelector('.rlmetrics'));
      if (!label) return { missingFixture: true };
      const roomId = label.dataset.id;
      const view = snapshot(label);
      const links = sr().querySelectorAll('.rlgo');
      const withArea = c._spaceModel().rooms.filter((room) => room.name && room.area).length;
      const room = sr().querySelector('.room');
      const viewIcon = label.querySelector('.rlgo');
      const viewCursor = getComputedStyle(viewIcon).cursor;
      const viewPointerEvents = getComputedStyle(viewIcon).pointerEvents;

      let viewNav = null;
      const viewPushState = history.pushState;
      history.pushState = (state, title, url) => { viewNav = url; };
      viewIcon.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      await c.updateComplete;
      history.pushState = viewPushState;

      c._setMode('plan');
      await settle();
      const planLabel = labelById(roomId);
      const planIcon = planLabel?.querySelector('.rlgo');
      const plan = planLabel ? snapshot(planLabel) : null;

      let planNav = null;
      const planPushState = history.pushState;
      history.pushState = (state, title, url) => { planNav = url; };
      planIcon?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      await c.updateComplete;
      history.pushState = planPushState;

      const iconBox = planIcon?.getBoundingClientRect();
      window.__roomLinkOriginalPushState = history.pushState;
      window.__roomLinkDragNav = null;
      history.pushState = (state, title, url) => { window.__roomLinkDragNav = url; };
      return {
        missingFixture: false,
        roomId,
        view,
        plan,
        roomCursor: getComputedStyle(room).cursor,
        viewLinkCount: links.length,
        withArea,
        viewCursor,
        viewPointerEvents,
        viewNav,
        planLinkCount: sr().querySelectorAll('.rlgo').length,
        planCursor: planIcon ? getComputedStyle(planIcon).cursor : '',
        planTitle: planIcon?.getAttribute('title') || '',
        planNav,
        planHandles: planLabel?.querySelectorAll('.rlhandle').length || 0,
        planSettingsButtons: sr().querySelectorAll('.rlgearbtn').length,
        beforeLayout: c._layout[`rl_${roomId}`] || null,
        dragTarget: iconBox ? { x: iconBox.left + iconBox.width / 2, y: iconBox.top + iconBox.height / 2 } : null,
        themeApplied: c.hass.themes.darkMode === dark,
      };
    }, { dark });

    if (setup.missingFixture) {
      checks[`${key}:fixture`] = false;
      continue;
    }

    let drag = { changed: false, dragNav: 'not-run', stayedInPlan: false };
    if (setup.dragTarget) {
      await page.mouse.move(setup.dragTarget.x, setup.dragTarget.y);
      await page.mouse.down();
      await page.mouse.move(setup.dragTarget.x + 24, setup.dragTarget.y + 16, { steps: 4 });
      await page.mouse.up();
      drag = await page.evaluate(async ({ roomId, beforeLayout }) => {
        const c = window.__card;
        await c.updateComplete;
        const after = c._layout[`rl_${roomId}`] || null;
        const changed = !!after && (!beforeLayout
          || Math.abs(after.x - beforeLayout.x) > 1e-6
          || Math.abs(after.y - beforeLayout.y) > 1e-6);
        const dragNav = window.__roomLinkDragNav;
        history.pushState = window.__roomLinkOriginalPushState;
        delete window.__roomLinkOriginalPushState;
        delete window.__roomLinkDragNav;
        return { changed, dragNav, stayedInPlan: c._mode === 'plan' };
      }, { roomId: setup.roomId, beforeLayout: setup.beforeLayout });
    }

    const values = ['left', 'top', 'width', 'height'];
    const nameDeltas = values.map((field) => Math.abs(setup.view.name[field] - setup.plan.name[field]));
    const metricDeltas = values.map((field) => Math.abs(setup.view.metrics[field] - setup.plan.metrics[field]));
    geometry.push({ key, nameDeltas, metricDeltas });
    checks[`${key}:fixture`] = !setup.missingFixture;
    checks[`${key}:room-cursor`] = setup.roomCursor === 'default';
    checks[`${key}:view-link-per-area-room`] = setup.viewLinkCount === setup.withArea;
    checks[`${key}:view-link-interactive`] = setup.viewCursor === 'pointer'
      && setup.viewPointerEvents === 'auto';
    checks[`${key}:view-navigates`] = typeof setup.viewNav === 'string'
      && setup.viewNav.includes('/config/areas/area/');
    checks[`${key}:plan-keeps-links`] = setup.planLinkCount === setup.withArea;
    checks[`${key}:plan-link-is-drag-affordance`] = setup.planCursor === 'grab'
      && setup.planTitle === '';
    checks[`${key}:plan-does-not-navigate`] = setup.planNav == null
      && drag.dragNav == null && drag.stayedInPlan;
    checks[`${key}:plan-icon-drags-label`] = drag.changed;
    checks[`${key}:core-name-parity`] = nameDeltas.every((delta) => delta <= 0.5);
    checks[`${key}:core-metrics-parity`] = metricDeltas.every((delta) => delta <= 0.5)
      && setup.view.metricsText === setup.plan.metricsText;
    checks[`${key}:plan-controls-preserved`] = setup.planHandles === 4
      && setup.planSettingsButtons > 0;
    checks[`${key}:theme-applied`] = setup.themeApplied;
  }
  await browser.close();
}

checkAll(checks);
await finish(null, { checks, geometry });
