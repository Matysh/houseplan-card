/** Base theme inputs, derived from the neutral demo/ui-lab/theme.css.
 * Component paint still belongs to UI Kit; these are not captured user tokens. */
const common = {
  '--primary-color': '#03a9f4', '--accent-color': '#ff9800', '--mdc-theme-primary': 'var(--primary-color)',
  '--text-primary-color': '#fff', '--disabled-text-color': '#777', '--error-color': '#db4437',
  '--warning-color': '#ffa600', '--success-color': '#43a047',
  '--ha-font-family-body': 'Roboto,Arial,sans-serif', '--ha-font-family-heading': 'var(--ha-font-family-body)',
  '--ha-font-size-scale': '1', '--ha-font-weight-body': '400', '--ha-font-weight-heading': '500',
  '--ha-font-weight-action': '500', '--mdc-icon-size': '24px',
  '--ha-card-background': 'var(--card-background-color)',
  '--ha-color-text-primary': 'var(--primary-text-color)', '--ha-color-text-secondary': 'var(--secondary-text-color)',
  '--ha-color-surface-default': 'var(--card-background-color)', '--ha-color-on-surface-default': 'var(--primary-text-color)',
  'font-family': 'var(--ha-font-family-body)',
};

export function standaloneTheme(darkMode: boolean): Readonly<Record<string, string>> {
  return Object.freeze({ ...common, 'color-scheme': darkMode ? 'dark' : 'light',
    '--primary-text-color': darkMode ? '#e1e1e1' : '#212121',
    '--secondary-text-color': darkMode ? '#9b9b9b' : '#727272',
    '--primary-background-color': darkMode ? '#111' : '#fafafa',
    '--secondary-background-color': darkMode ? '#202020' : '#e5e5e5',
    '--card-background-color': darkMode ? '#1c1c1c' : '#fff',
    '--divider-color': darkMode ? '#383838' : '#e0e0e0',
    '--app-header-background-color': darkMode ? '#101e24' : '#03a9f4',
    '--app-header-text-color': darkMode ? '#e1e1e1' : '#fff',
  });
}
