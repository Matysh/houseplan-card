/** The shared hp-help/tooltip bubble; callers own placement and lifecycle. */
export const helpSurfaceStyle = `
  width:max-content; max-width:min(320px,calc(100vw - 16px));
  max-height:calc(100vh - 16px); box-sizing:border-box; padding:9px 11px; overflow:auto;
  color:var(--primary-text-color,#fff); background:var(--card-background-color,#202126);
  border:1px solid var(--divider-color,rgb(255 255 255 / .2)); border-radius:9px;
  box-shadow:0 8px 24px rgb(0 0 0 / .32); font:400 13px/1.4 system-ui,sans-serif;
  text-align:start; white-space:normal; overflow-wrap:anywhere;
`;

/** Secondary lines in a multi-value tooltip use the same body typography. */
export const helpSurfaceMetaStyle = 'display:block;color:var(--secondary-text-color);font-size:13px;line-height:1.4;';
