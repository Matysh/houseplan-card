// UI-001 v5: recompute contact contours for upright device badges after rotation, 280ms.
// Capture the current card at click time; do not rely on a cached card instance.
(() => {
  document.documentElement.dataset.ui001 = 'contact-recalculation-v5';
  let busy = false;
  const queue = [];
  const contactRoots = new WeakMap();
  const orientContacts = root => {
    const state = contactRoots.get(root);
    const source = state?.card._deviceContacts;
    const scene = source?.scene;
    if (!scene) return;
    const matrix = root.querySelector('svg.plan-svg > g')?.transform.baseVal.consolidate()?.matrix;
    const a = matrix?.a ?? 1, b = matrix?.b ?? 0, c = matrix?.c ?? 0, d = matrix?.d ?? 1;
    const e = matrix?.e ?? 0, f = matrix?.f ?? 0;
    const turn = ([x, y]) => [a*x+c*y+e, b*x+d*y+f];
    const markers = [...scene.shapes.values()].map(({marker}) => {
      const [x,y] = turn([marker.x,marker.y]);
      // Reuse measured upright face boxes, never rotate yesterday's contour.
      return {...marker,x,y};
    });
    const key = JSON.stringify([a,b,c,d,e,f,source.work.paints,markers]);
    if (state.key === key) return;
    state.key = key;
    const walls = scene.walls.map(wall => ({...wall,a:turn(wall.a),b:turn(wall.b),
      normal:wall.normal ? [a*wall.normal[0]+c*wall.normal[1],b*wall.normal[0]+d*wall.normal[1]] : null}));
    const masonry = scene.masonry.map(polygon => polygon.map(ring => ring.map(turn)));
    // A separate visual renderer leaves persisted coordinates and the native
    // placement solver untouched during this owner-reviewed UI prototype.
    state.visual ??= new source.constructor();
    state.visual.elements = source.elements;
    state.visual.scene = new scene.constructor(markers,walls,masonry,true);
    state.visual.paint(state.visual.scene.shapes.keys());
    root.querySelector('.stage')?.setAttribute('data-ui001-contours','recalculated');
  };
  const installContactRotation = card => {
    const root = card?.shadowRoot;
    if (!root || contactRoots.has(root)) return;
    contactRoots.set(root,{card,key:null,visual:null});
    new MutationObserver(() => orientContacts(root)).observe(root, {
      subtree:true, childList:true, attributes:true, attributeFilter:['transform'],
    });
    orientContacts(root);
  };
  const panel = document.querySelector('houseplan-panel');
  if (panel?.shadowRoot) {
    const install = () => installContactRotation(panel.shadowRoot.querySelector('houseplan-card'));
    new MutationObserver(install).observe(panel.shadowRoot, {childList: true, subtree: true});
    install();
  }
  const pixelScale = stage => {
    const box = stage.querySelector('svg.plan-svg')?.viewBox.baseVal;
    return box?.width && box?.height ? Math.min(stage.clientWidth / box.width, stage.clientHeight / box.height) : 1;
  };
  document.addEventListener('click', event => {
    const path = event.composedPath();
    const button = path.find(node => node?.matches?.('[data-hp="rotate-left"], [data-hp="rotate-right"]'));
    const card = path.find(node => node?.localName === 'houseplan-card');
    if (!button || !card) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    queue.push({card, direction: button.dataset.hp === 'rotate-right' ? 1 : -1});
    if (!busy) void next();
  }, true);
  async function next() {
    if (!queue.length) { busy = false; return; }
    busy = true;
    const {card, direction} = queue.shift();
    installContactRotation(card);
    const before = card.shadowRoot.querySelector('.stage');
    if (!before || !card.isConnected) { busy = false; return next(); }
    const oldScale = pixelScale(before);
    card._rotatePlan(direction);
    await card.updateComplete;
    orientContacts(card.shadowRoot);
    const stage = card.shadowRoot.querySelector('.stage');
    const ratio = oldScale / pixelScale(stage);
    const plan = stage.querySelector('.zoomwrap');
    if (!plan) { busy = false; return next(); }
    const parent = stage;
    const previousOverflow = parent.style.overflow;
    parent.style.overflow = 'hidden';
    plan.style.transformOrigin = '50% 50%';
    plan.style.willChange = 'transform';
    const start = performance.now();
    let frames = 0;
    document.documentElement.dataset.ui001State = 'rotating';
    const frame = now => {
      const progress = Math.min(1, Math.max(0, (now - start) / 280));
      const eased = 1 - Math.pow(1 - progress, 3);
      const angle = -direction * 90 * (1 - eased);
      plan.style.transform = `rotate(${angle}deg) scale(${ratio + (1 - ratio) * eased})`;
      stage.dataset.ui001Angle = angle.toFixed(1);
      frames++;
      if (progress < 1) requestAnimationFrame(frame);
      else {
        plan.style.removeProperty('transform');
        plan.style.removeProperty('transform-origin');
        plan.style.removeProperty('will-change');
        parent.style.overflow = previousOverflow;
        document.documentElement.dataset.ui001State = 'finished';
        document.documentElement.dataset.ui001Frames = String(frames);
        busy = false;
        void next();
      }
    };
    frame(start);
  }
})();
