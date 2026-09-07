/**
 * Каталог сценариев съёмки документации. Отдельным модулем, потому что его
 * читают трое: сам капчур, `scripts/check-docs.mjs` и приёмка артефакта
 * `scripts/docs-accept.mjs` (#246). Импортировать его из `capture.mjs` нельзя —
 * тот скрипт при импорте поднимает браузер и снимает картинки.
 */
export const DOC_SCREENSHOT_VERSION = 2;
export const DOC_SCREENSHOTS = Object.freeze([
  {
    id: 'view-desktop', file: '01-view-desktop.png', fixture: 'visual',
    space: 'golden-lighting', mode: 'view', roomMetrics: true,
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 900 }, capture: 'page',
  },
  {
    id: 'view-touch', file: '02-view-touch.png', fixture: 'visual',
    space: 'golden-lighting', mode: 'view', roomMetrics: true, kiosk: true,
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 390, height: 760 }, capture: 'page',
  },
  {
    id: 'space-create', file: '03-space-create.png', fixture: 'empty', noFloors: true,
    title: 'House Plan', language: 'en', theme: 'dark',
    viewport: { width: 900, height: 850 }, capture: 'page', expectDialog: true,
  },
  {
    id: 'room-contour-close', file: '04-room-contour-close.png', fixture: 'visual',
    space: 'golden-geometry', mode: 'plan',
    wallJunctionPreview: {
      path: [[0.18, 0.18], [0.40, 0.18], [0.40, 0.40], [0.18, 0.40]],
      pointer: [0.18, 0.18], cms: [440, 440, 440], cm: 15,
    },
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 900 }, capture: 'page',
  },
  {
    id: 'plan-context-tray', file: '05-plan-context-tray.png', fixture: 'visual',
    space: 'golden-geometry', mode: 'plan', editorTray: 'plan-selection',
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 900 }, capture: 'page',
  },
  {
    id: 'device-editor', file: '06-device-editor.png', fixture: 'visual',
    space: 'golden-lighting', dialog: 'device', deviceId: 'golden-light-two',
    deviceName: 'Living-room ceiling light',
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 1100 }, capture: 'page', expectDialog: true,
  },
  {
    id: 'device-display-preview', file: '06-device-display-preview.png', fixture: 'visual',
    space: 'golden-lighting', dialog: 'device', deviceId: 'golden-light-two',
    deviceName: 'Living-room ceiling light', devicePresentationPreview: true,
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 1100 }, capture: 'page', expectDialog: true,
  },
  {
    id: 'background-editor', file: '07-background-editor.png', fixture: 'visual',
    space: 'golden-geometry', mode: 'decor', editorTray: 'decor-selection',
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 900 }, capture: 'page',
  },
  {
    id: 'room-card', file: '08-room-card.png', fixture: 'visual',
    space: 'golden-lighting', mode: 'view', roomMetrics: true,
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 900 }, capture: 'room-card',
  },
  {
    id: 'device-info', file: '09-device-info.png', fixture: 'visual',
    space: 'golden-lighting', mode: 'view', dialog: 'device-info',
    deviceId: 'golden-light-two', deviceName: 'Living-room ceiling light',
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1000, height: 900 }, capture: 'page', expectDialog: true,
  },
  {
    id: 'pdf-export', file: '10-pdf-export.png', fixture: 'visual',
    space: 'golden-geometry', mode: 'view', dialog: 'pdf',
    title: 'House Plan — synthetic home', language: 'en', theme: 'light',
    viewport: { width: 900, height: 760 }, capture: 'page', expectDialog: true,
  },
]);
