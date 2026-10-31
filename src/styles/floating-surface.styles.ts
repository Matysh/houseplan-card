/** Shared floating-control paint. Coordinates, size and scrolling belong to the owner. */
export function floatingSurfaceCss(selector: string): string {
  return `${selector} { box-sizing:border-box; padding:12px; color:var(--primary-text-color); background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:10px; box-shadow:0 10px 28px rgb(0 0 0 / 34%); }`;
}
