const DEVANAGARI_ZERO = 0x0966;

/** Convert Devanagari digits to ASCII so the API always receives 0-9. */
export function toAsciiDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out += code >= DEVANAGARI_ZERO && code <= DEVANAGARI_ZERO + 9 ? String(code - DEVANAGARI_ZERO) : ch;
  }
  return out;
}

/** Normalise typed text for a decimal field: ASCII digits, one dot. */
export function sanitizeDecimal(input: string): string {
  const cleaned = toAsciiDigits(input).replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}
