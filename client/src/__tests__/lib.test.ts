import { toAsciiDigits, sanitizeDecimal } from '@/lib/digits';
import { formatRs, formatNumber } from '@/lib/money';
import { buildReportHtml } from '@/features/report/buildReportHtml';
import type { CalculateResponse } from '@/api/types';

describe('digits', () => {
  it('converts Devanagari to ASCII', () => { expect(toAsciiDigits('१२३.५')).toBe('123.5'); });
  it('handles mixed and empty input', () => { expect(toAsciiDigits('१2३')).toBe('123'); expect(toAsciiDigits('')).toBe(''); });
  it('keeps a single dot', () => { expect(sanitizeDecimal('१.२.३a')).toBe('1.23'); });
});

describe('money', () => {
  it('groups lakh style', () => { expect(formatRs('123456.5')).toBe('Rs 1,23,456.50'); });
  it('handles zero and large values', () => { expect(formatRs('0')).toBe('Rs 0.00'); expect(formatNumber('12345678901')).toBe('12,34,56,78,901'); });
  it('passes through non-numeric text', () => { expect(formatNumber('abc')).toBe('abc'); });
});

const result: CalculateResponse = {
  currency: 'NPR', grandTotal: '300.00', invalid: [],
  groups: [
    { categoryKey: 'b', label: 'Beta <b>', labelNe: 'बिटा', rate: { value: '10', per: 'area' }, items: [{ id: '1', label: 'Room', qty: '10', unit: 'sq ft', amount: '100.00' }], subtotal: '100.00' },
    { categoryKey: 'a', label: 'Alpha', labelNe: 'अल्फा', rate: { value: '20', per: 'area' }, items: [{ id: '2', label: 'Hall', qty: '10', unit: 'sq ft', amount: '200.00' }], subtotal: '200.00' },
  ],
};

describe('buildReportHtml', () => {
  const html = buildReportHtml(result, { language: 'en', projectTitle: 'Site', date: '2026-10-27' });
  it('keeps server order and total', () => { expect(html.indexOf('Beta')).toBeLessThan(html.indexOf('Alpha')); expect(html).toContain('Rs 300.00'); });
  it('escapes HTML', () => { expect(html).toContain('Beta &lt;b&gt;'); expect(html).not.toContain('Beta <b>'); });
  it('switches labels by language', () => { expect(buildReportHtml(result, { language: 'ne', projectTitle: 'x', date: 'd' })).toContain('अल्फा'); });
});
