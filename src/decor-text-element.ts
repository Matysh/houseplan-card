/** Literal DOM IDs use the ShadowRoot index, including arbitrary stored decor IDs. */
export const decorTextElementId = (id: string): string => `hp-decor-text:${id}`;

/** Only the settled layer owns IDs; transient live-editor copies are never indexed. */
export function decorTextElement(root: ParentNode, id: string): SVGGraphicsElement | null {
  if (!('getElementById' in root) || typeof root.getElementById !== 'function') return null;
  return root.getElementById(decorTextElementId(id)) as SVGGraphicsElement | null;
}
