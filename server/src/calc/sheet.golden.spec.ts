import { CalcItem, CalcRate, calculate } from './calculation';
import { parseMeasurementText } from '../extraction/text-parser';
import { normalizeExtractedItem } from '../extraction/normalizer';
import { D } from '../lib/decimal';

/**
 * The real notebook: Tile / Marble, rate Rs 40 per sq ft.
 * The writer's own answer: total 1273.65 sq ft, amount Rs 50946.
 */
const PAGE_1 = ['1.4 x 1.5', '29', '13 x 11.9', '5.9 x 1.2', '12.2 x 3', '1.9 x 2.7', '35.6', '9', '119.6', '119.6 + 16.5', '36 x 14.6', '9 x 18', '10', '8.2 x 2.7', '19'].join('\n');
const PAGE_2 = `1.4 x 1.5 = 2.1
29
13 x 11.9 = 154.7
5.9 x 1.2 = 7.08
12.2 x 3 = 36.6
1.9 x 2.7 = 5.13
35.6
9
119.6
119.6 + 16.5 = 136.1
36 x 14.6 = 525.6
9 x 18 = 162
10
8.2 x 2.7 = 22.14
19`;

const items = (text: string): CalcItem[] =>
  parseMeasurementText(text).map((raw, i) => ({ id: `l${i}`, ...normalizeExtractedItem(raw, 'tile') }));
const rates: Record<string, CalcRate> = { tile: { value: new D('40'), per: 'area', label: 'Tile / Marbal' } };

describe('notebook sheet: Tile / Marble at Rs 40', () => {
  const r = calculate(items(PAGE_1), rates, 'decimal');

  it('every line gives the area the writer worked out', () => {
    expect(r.invalid).toEqual([]);
    expect(r.groups[0].items.map((l) => l.qty)).toEqual([
      '2.10', '29.00', '154.70', '7.08', '36.60', '5.13', '35.60', '9.00', '119.60', '136.10', '525.60', '162.00', '10.00', '22.14', '19.00',
    ]);
  });
  it('total area is 1273.65 sq ft and the amount is Rs 50946', () => {
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].totalQty).toBe('1273.65');
    expect(r.groups[0].unit).toBe('sqft');
    expect(r.groups[0].rate.value).toBe('40.00');
    expect(r.groups[0].subtotal).toBe('50946.00');
    expect(r.grandTotal).toBe('50946.00');
  });
  it('page 2 (with the writer\'s results) gives the same answer, and every written result agrees', () => {
    const r2 = calculate(items(PAGE_2), rates, 'decimal');
    expect(r2.grandTotal).toBe('50946.00');
    expect(r2.warnings).toEqual([]);
  });
  it('a wrong written result is reported, not ignored', () => {
    const bad = items(PAGE_2.replace('= 154.7', '= 154.1'));
    const r3 = calculate(bad, rates, 'decimal');
    expect(r3.warnings).toEqual([expect.objectContaining({ reason: 'RESULT_MISMATCH', written: '154.1', computed: '154.70' })]);
    expect(r3.grandTotal).toBe('50946.00'); // we trust the numbers we read, and tell the user to check
  });
  it('a written result that agrees clears a low-confidence flag', () => {
    const list = items(PAGE_2).map((i) => ({ ...i, uncertain: true }));
    const r4 = calculate(list, rates, 'decimal');
    // 9 lines have a written result that agrees (cleared). The 6 plain numbers (29, 35.6, 9, 119.6, 10, 19) stay flagged.
    expect(r4.warnings.map((w) => w.id)).toEqual(['l1', 'l6', 'l7', 'l8', 'l12', 'l14']);
  });
  it('feet-inches mode reads the factors differently but never breaks the sheet', () => {
    const r5 = calculate(items(PAGE_1), rates, 'feet_inches');
    expect(r5.invalid).toEqual([]);
    expect(r5.grandTotal).not.toBe('50946.00');
  });
});
