// #1119 and #1120 change Properties and panel chrome without new DOM hooks.
// Source snapshots may carry beta.3 until the candidate bump: an old-version
// skip is never new-contract proof. Source snapshots with #1120's explicit
// retirement and the eventual exact beta.4 candidate must execute these checks.
import { installedContract, installedRecord } from './contract.mjs';
import { compareTags } from '../../scripts/tags.mjs';
export function hasBeta4PanelContract(version = installedRecord()?.version, contract = installedContract()) {
  // A source snapshot retains beta.3 until release preparation. The installed
  // product explicitly retires its outer title in #1120; use that declaration
  // to execute the new expectations without inventing a released version.
  const title = contract?.retiredHooks?.['panel-title'];
  if (title?.issue === 1120 && title.retired === '1.83.0-beta.4') return true;
  return !version || compareTags(`v${version}`, 'v1.83.0-beta.4') >= 0;
}

// #1132 is shipped by beta.5; older release runs keep their own assertions.
export function hasBeta5UiPolishContract(version = installedRecord()?.version) {
  return !!version && compareTags(`v${version}`, 'v1.83.0-beta.5') >= 0;
}
