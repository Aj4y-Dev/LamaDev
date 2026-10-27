/** Display-only formatting. Never performs arithmetic on money. */
export function formatNumber(value: string | number): string {
  const raw = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  const negative = raw.startsWith('-');
  const [intPart, fraction] = raw.replace('-', '').split('.');
  const noLeadingZeros = intPart.replace(/^0+(?=\d)/, '');
  let grouped = noLeadingZeros;
  if (noLeadingZeros.length > 3) {
    const last3 = noLeadingZeros.slice(-3);
    const rest = noLeadingZeros.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  return `${negative ? '-' : ''}${grouped}${fraction !== undefined ? `.${fraction}` : ''}`;
}

/** "Rs 1,23,456.50" — pads to two decimals as text, no numeric math. */
export function formatRs(value: string | number): string {
  const raw = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return `Rs ${raw}`;
  const [i, f = ''] = raw.split('.');
  const fixed = `${i}.${(f + '00').slice(0, Math.max(2, f.length))}`;
  return `Rs ${formatNumber(fixed)}`;
}
