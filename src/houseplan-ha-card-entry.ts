/** Installed Lovelace entry. Keep HA-only discovery out of the renderer. */
import { HouseplanCard, CARD_VERSION } from './houseplan-card';
import './space-card';
import { registerPickerCard } from './card-picker-registration';
import { entryBuildLabel, formatBuild } from './build-identity';
export { HouseplanCard } from './houseplan-card';

if (!customElements.get('houseplan-card')) customElements.define('houseplan-card', HouseplanCard);
registerPickerCard('houseplan-card');
// #836: preserve the installed entry's version/channel banner.
console.info(`%c HOUSEPLAN-CARD %c v${formatBuild(CARD_VERSION, entryBuildLabel())} `, 'background:#3ea6ff;color:#04121f;font-weight:700', '');
