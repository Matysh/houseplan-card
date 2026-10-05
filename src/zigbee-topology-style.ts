/** #798: route colours deliberately do not change device/room LQI colours. */
export function zigbeeLinkColor(lqi: number | undefined): string {
  if (lqi === undefined || !Number.isFinite(lqi) || lqi < 0 || lqi > 255) return '#919ba5';
  const red = lqi <= 128 ? 255 : Math.round(255 * (255 - lqi) / 127);
  const green = lqi >= 128 ? 255 : Math.round(255 * lqi / 128);
  return `rgb(${red}, ${green}, 0)`;
}
