/** Houseplan writing and HA administration are deliberately separate rights. */
export function deviceEditorAllowed(writer: boolean, kiosk: boolean): boolean {
  return writer && !kiosk;
}

export function roomAreaAffordance(access: {
  admin: boolean; writer: boolean; kiosk: boolean; plan: boolean;
}): { visible: boolean; interactive: boolean } {
  const interactive = access.admin && !access.kiosk && !access.plan;
  return { visible: interactive || access.plan && deviceEditorAllowed(access.writer, access.kiosk), interactive };
}
