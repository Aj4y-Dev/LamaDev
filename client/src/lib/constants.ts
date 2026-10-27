/** Label-only fallback when the API omits labels. Not used for ordering results. */
export const CATEGORY_FALLBACK: Record<string, { en: string; ne: string }> = {
  tiles_marble: { en: 'Tiles / Marble', ne: 'टाइल्स / मार्बल' },
  plaster: { en: 'Plaster', ne: 'प्लास्टर' },
  koramasino: { en: 'Koramasino', ne: 'कोरामसिनो' },
  unknown: { en: 'Unknown', ne: 'अज्ञात' },
};
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2000;
export const UNKNOWN_CATEGORY = 'unknown';
