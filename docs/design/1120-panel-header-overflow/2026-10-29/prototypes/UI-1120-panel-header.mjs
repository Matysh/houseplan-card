// #1120: local visual adapter; no product implementation or HA navigation.
(() => {
  const panel = document.querySelector('houseplan-panel');
  const panelRoot = panel?.shadowRoot;
  const card = panelRoot?.querySelector('houseplan-card');
  const root = card?.shadowRoot;
  const menu = panelRoot?.querySelector('[data-hp="panel-menu"]');
  if (!root || !menu) return;
  const panelStyle = document.createElement('style');
  panelStyle.textContent = '.appbar{display:none!important}.page{grid-template-rows:minmax(0,1fr)}';
  panelRoot.append(panelStyle);
  const style = document.createElement('style');
  style.textContent = `
    .hdr{top:0}
    .head > .ui1120-menu{width:44px;height:44px;min-width:44px;flex:0 0 44px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--hp-txt);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background 150ms ease}
    .head > .ui1120-menu[hidden]{display:none}
    .ui1120-menu ha-icon{--mdc-icon-size:24px}
    .ui1120-menu:hover{background:rgba(127,127,127,.16)}
    .ui1120-menu:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
    @media(width < 360px){ha-card:not([data-hp-mode='view']) > .hdr > .head{grid-template-columns:44px minmax(0,1fr) 24px}}
    @media(prefers-reduced-motion:reduce){.ui1120-menu{transition:none}}
  `;
  root.append(style);
  menu.classList.add('ui1120-menu');

  // UI Lab has no real HA sidebar. Keep its simulation outside the card.
  // On a real panel this state/event belongs to HA; do not port the mock.
  const shellStyle = document.createElement('style');
  shellStyle.textContent = `
    #ui1120-sidebar{position:fixed;inset:0 auto 0 0;width:256px;z-index:180;background:var(--sidebar-background-color,var(--card-background-color,#1c1c1c));color:var(--primary-text-color);border-right:1px solid var(--divider-color);box-sizing:border-box;font:14px Roboto,sans-serif}
    #ui1120-sidebar[hidden],#ui1120-scrim[hidden]{display:none}
    #ui1120-sidebar header{height:64px;display:flex;align-items:center;gap:12px;padding:0 12px;font-size:18px}
    #ui1120-sidebar button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer}
    #ui1120-sidebar .close{width:44px;height:44px;border-radius:50%;display:grid;place-items:center}
    #ui1120-sidebar .close:hover{background:#8882}
    #ui1120-sidebar .selected{display:flex;align-items:center;gap:20px;border-radius:24px;margin:8px;padding:14px 20px;width:calc(100% - 16px);color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 12%,transparent)}
    #ui1120-sidebar small{display:block;padding:12px 24px;color:var(--secondary-text-color);line-height:1.5}
    #ui1120-scrim{position:fixed;inset:0;background:#0006;z-index:179}
    body.ui1120-docked #product{margin-left:256px;width:calc(100% - 256px)}
  `;
  document.head.append(shellStyle);
  const sidebar = document.createElement('aside');
  sidebar.id = 'ui1120-sidebar'; sidebar.hidden = true;
  sidebar.setAttribute('aria-label','Боковое меню Home Assistant — прототип');
  sidebar.innerHTML = '<header><button class="close" aria-label="Скрыть боковое меню HA"><ha-icon icon="mdi:menu"></ha-icon></button><strong>Home Assistant</strong></header><button class="selected"><ha-icon icon="mdi:floor-plan"></ha-icon>House Plan</button><small>Локальный прототип бокового меню HA</small>';
  const scrim = document.createElement('div'); scrim.id = 'ui1120-scrim'; scrim.hidden = true;
  document.body.append(scrim,sidebar);
  let opened = false;
  const narrow = () => matchMedia('(max-width:870px)').matches;
  const sync = () => {
    const head = root.querySelector('.hdr > .head');
    if (head && menu.parentNode !== head) head.prepend(menu);
    const isNarrow = narrow();
    const hide = !isNarrow && opened;
    if (menu.hidden !== hide) menu.hidden = hide;
    sidebar.hidden = !opened;
    scrim.hidden = !opened || !isNarrow;
    document.body.classList.toggle('ui1120-docked',opened && !isNarrow);
  };
  const toggle = event => {
    event?.preventDefault(); event?.stopImmediatePropagation();
    opened = !opened; sync();
  };
  // Capture prevents the harness's old menu => UI LAB shortcut. The native
  // HA event handler is still preserved on the moved button for reference.
  menu.addEventListener('click',toggle,true);
  sidebar.querySelector('.close').onclick = toggle;
  sidebar.querySelector('.selected').onclick = () => {if(narrow()){opened=false;sync();}};
  scrim.onclick = () => {opened=false;sync();};
  document.addEventListener('keydown',event => {if(event.key==='Escape' && opened && narrow()){opened=false;sync();}});
  addEventListener('resize',sync);
  new MutationObserver(sync).observe(root,{childList:true,subtree:true});
  sync();
})();
