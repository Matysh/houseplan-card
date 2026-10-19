// #955: bounded pair of the unchanged full interaction/viewport/theme matrix.
import { finish } from './serve.mjs';
import { runSettingsPolish955 } from './helpers/settings-polish-955.mjs';
await runSettingsPolish955(['vacuum', 'radar'], (browser, out) => finish(browser, out));
