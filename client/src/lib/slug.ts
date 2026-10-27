/** Turns a typed work name into a stable key, e.g. "Tiles / Marble" -> "tiles_marble". */
export function workKey(name: string): string {
  const trimmed = name.trim();
  const ascii = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (ascii) return ascii;
  // Nepali-only names have no ASCII letters, so derive a short stable key instead.
  let h = 0;
  for (const ch of trimmed) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return `work_${h.toString(36)}`;
}
