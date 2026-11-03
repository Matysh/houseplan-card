/**
 * Test users of the ephemeral Home Assistant. The passwords are deliberately
 * plain: the instance lives for one CI run, listens on the runner's loopback
 * only and holds nothing but the anonymized demo house. Override with
 * E2E_ADMIN_PASSWORD / E2E_VIEWER_PASSWORD when running against anything else.
 */
export const USERS = {
  admin: {
    username: 'demo',
    password: process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-pass',
    storageState: '.auth/admin.json',
  },
  viewer: {
    username: 'viewer',
    password: process.env.E2E_VIEWER_PASSWORD || 'e2e-viewer-pass',
    storageState: '.auth/viewer.json',
  },
};

export const HA_URL = (process.env.HA_URL || 'http://127.0.0.1:8123').replace(/\/$/, '');
