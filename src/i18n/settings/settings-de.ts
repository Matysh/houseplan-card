import dictionary from './de.json' with { type: 'json' };

/** #627: lazy `settings` × `de` chunk; must match the entry build before it is committed. */
export const fingerprint = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

export { dictionary };
