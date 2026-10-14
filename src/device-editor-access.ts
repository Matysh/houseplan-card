/** Houseplan writing and HA administration are deliberately separate rights. */
export function deviceEditorAllowed(writer: boolean, kiosk: boolean): boolean {
  return writer && !kiosk;
}

export function roomAreaAffordance(access: {
  admin: boolean; writer: boolean; kiosk: boolean; plan: boolean; view: boolean;
}): { visible: boolean; interactive: boolean } {
  const visible = !access.kiosk && (access.plan ? access.writer : access.admin);
  return { visible, interactive: visible && !access.plan && access.view };
}
