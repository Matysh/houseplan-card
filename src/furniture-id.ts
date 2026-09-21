/** #606: the 0.4.0 pack mislabeled an exercise machine as `cactus`.
 * Resolve that saved id at read time; never rewrite a user's decor record. */
export function canonicalFurnitureId(id: string): string {
  return id === 'cactus' ? 'exercise' : id;
}
