import dictionary from './ru.json' with { type: 'json' };

/** #627: lazy `settings` × `ru` chunk; must match the entry build before it is committed. */
export const fingerprint = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

export { dictionary };
