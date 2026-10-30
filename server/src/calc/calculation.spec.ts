import { CalcItem, CalcRate, calculate } from './calculation';
import { parseDimension } from './dimension';
import { D } from '../lib/decimal';

const rate = (value: string, per: 'area' | 'length' | 'count', label = 'Work'): CalcRate => ({ value: new D(value), per, label });
const item = (over: Partial<CalcItem>): CalcItem => ({ id: 'a', categoryKey: 'tiles', label: 'Hall', length: '10', breadth: '10', count: null, unit: 'ft', ...over });

const feet = (raw: string, mode: 'decimal' | 'feet_inches', unit: 'ft' | 'm' = 'ft') => {
  const r = parseDimension(raw, mode, unit);
  return r.ok ? r.feet.n.div(r.feet.d).toFixed() : r.reason;
};

describe('parseDimension', () => {
  it('decimal mode reads 10.5 as 10.5 ft', () => expect(feet('10.5', 'decimal')).toBe('10.5'));
  it('feet_inches mode reads the digits after the dot as inches', () => {
    expect(feet('10.6', 'feet_inches')).toBe('10.5'); // 10 ft 6 in
    expect(feet('10.0', 'feet_inches')).toBe('10');
    expect(feet('10', 'feet_inches')).toBe('10');
    expect(new D(feet('10.11', 'feet_inches')).toDecimalPlaces(6).toFixed()).toBe('10.916667');
  });
  it('feet_inches: 10.1 is 1 inch and 10.10 is 10 inches', () => {
    expect(new D(feet('10.1', 'feet_inches')).toDecimalPlaces(4).toFixed()).toBe('10.0833');
    expect(new D(feet('10.10', 'feet_inches')).toDecimalPlaces(4).toFixed()).toBe('10.8333');
  });
  it('feet_inches rejects 12 inches or more and long fractions', () => {
    expect(feet('10.12', 'feet_inches')).toBe('INVALID');
    expect(feet('10.99', 'feet_inches')).toBe('INVALID');
    expect(feet('10.125', 'feet_inches')).toBe('INVALID');
  });
  it('explicit feet-inches notation is read the same in both modes', () => {
    for (const mode of ['decimal', 'feet_inches'] as const) {
      expect(feet(`14'6"`, mode)).toBe('14.5');
      expect(feet('14-6', mode)).toBe('14.5');
      expect(feet(`14' 6`, mode)).toBe('14.5');
      expect(feet(`14'`, mode)).toBe('14');
    }
    expect(feet(`14'12"`, 'decimal')).toBe('INVALID');
  });
  it('metres are always decimal, converted with 1 m = 3.28084 ft', () => {
    expect(feet('1', 'decimal', 'm')).toBe('3.28084');
    expect(feet('2.5', 'feet_inches', 'm')).toBe('8.2021');
  });
  it('flags missing and bad input', () => {
    expect(feet('', 'decimal')).toBe('MISSING');
    expect(feet('abc', 'decimal')).toBe('INVALID');
    expect(feet('1.2.3', 'decimal')).toBe('INVALID');
    expect(feet('-5', 'decimal')).toBe('INVALID');
  });
});

describe('calculate: worked examples', () => {
  it('14.5 x 4.5 x 15 = 978.75 exactly (no float drift)', () => {
    const r = calculate([item({ length: '14.5', breadth: '4.5' })], { tiles: rate('15', 'area') }, 'decimal');
    expect(r.groups[0].items[0].qty).toBe('65.250');
    expect(r.groups[0].items[0].amount).toBe('978.75');
    expect(r.grandTotal).toBe('978.75');
  });
  it('decimal: 12.6 x 10.3 x 85 = 11031.30', () => {
    expect(calculate([item({ length: '12.6', breadth: '10.3' })], { tiles: rate('85', 'area') }, 'decimal').grandTotal).toBe('11031.30');
  });
  it('feet_inches: 12.6 x 10.3 is 12.5 x 10.25 = 128.125 sq ft, x 85 = 10890.625 -> 10890.63 (half up)', () => {
    const r = calculate([item({ length: '12.6', breadth: '10.3' })], { tiles: rate('85', 'area') }, 'feet_inches');
    expect(r.groups[0].items[0].qty).toBe('128.125');
    expect(r.grandTotal).toBe('10890.63');
  });
  it('the same text gives different results in the two modes', () => {
    const a = calculate([item({ length: '10.6', breadth: '10' })], { tiles: rate('1', 'area') }, 'decimal');
    const b = calculate([item({ length: '10.6', breadth: '10' })], { tiles: rate('1', 'area') }, 'feet_inches');
    expect(a.grandTotal).toBe('106.00');
    expect(b.grandTotal).toBe('105.00');
  });
  it('rounds each line half-up at 2 decimals, and totals the rounded lines', () => {
    const r = calculate(
      [item({ id: '1', length: '0.125', breadth: '1' }), item({ id: '2', length: '0.125', breadth: '1' })],
      { tiles: rate('1', 'area') }, 'decimal',
    );
    expect(r.groups[0].items.map((l) => l.amount)).toEqual(['0.13', '0.13']);
    expect(r.groups[0].subtotal).toBe('0.26');
    expect(r.grandTotal).toBe('0.26');
  });
  it('length and count strategies', () => {
    const r = calculate(
      [item({ id: 'l', categoryKey: 'kora', length: '20', breadth: null }), item({ id: 'c', categoryKey: 'doors', count: 3 })],
      { kora: rate('30', 'length'), doors: rate('100', 'count') }, 'decimal',
    );
    expect(r.groups.map((g) => g.subtotal)).toEqual(['600.00', '300.00']);
    expect(r.grandTotal).toBe('900.00');
  });
  it('a count line with no count is one piece', () => {
    expect(calculate([item({ categoryKey: 'doors', count: null })], { doors: rate('100', 'count') }, 'decimal').grandTotal).toBe('100.00');
  });
  it('groups work types in order of first appearance and combines photos of one type', () => {
    const r = calculate(
      [item({ id: '1', categoryKey: 'kora' }), item({ id: '2', categoryKey: 'tiles' }), item({ id: '3', categoryKey: 'kora' })],
      { kora: rate('2', 'area', 'Koramasino'), tiles: rate('3', 'area', 'Tiles') }, 'decimal',
    );
    expect(r.groups.map((g) => g.label)).toEqual(['Koramasino', 'Tiles']);
    expect(r.groups[0].items).toHaveLength(2);
    expect(r.grandTotal).toBe('700.00'); // 2 x 100 x 2 + 100 x 3
  });
  it('shows a rate with more than 2 decimals exactly as it was used', () => {
    const r = calculate([item({ length: '10', breadth: '10' })], { tiles: rate('12.345', 'area') }, 'decimal');
    expect(r.groups[0].rate.value).toBe('12.345');
    expect(r.grandTotal).toBe('1234.50');
    expect(calculate([item({})], { tiles: rate('85', 'area') }, 'decimal').groups[0].rate.value).toBe('85.00');
  });
  it('shows the size as written, with the unit when it is not feet', () => {
    expect(calculate([item({ length: '10.8', breadth: '9.6' })], { tiles: rate('10', 'area') }, 'feet_inches').groups[0].items[0].size).toBe('10.8 × 9.6');
    expect(calculate([item({ length: '3', breadth: '2', unit: 'm' })], { tiles: rate('10', 'area') }, 'decimal').groups[0].items[0].size).toBe('3 × 2 m');
  });
});

describe('calculate: bad lines are reported, never dropped or guessed', () => {
  it('gives a reason for every kind of bad line', () => {
    const r = calculate(
      [
        item({ id: 'u', categoryKey: 'unknown' }),
        item({ id: 'n', categoryKey: 'nothing' }),
        item({ id: 'b', breadth: null }),
        item({ id: 'l', length: null }),
        item({ id: 'z', length: '0' }),
        item({ id: 'x', length: '10.12' }),
        item({ id: 'big', length: '1260' }),
        item({ id: 'junk', breadth: 'abc' }),
      ],
      { tiles: rate('10', 'area') }, 'feet_inches',
    );
    expect(Object.fromEntries(r.invalid.map((i) => [i.id, i.reason]))).toEqual({
      u: 'UNKNOWN_CATEGORY', n: 'NO_RATE', b: 'MISSING_BREADTH', l: 'MISSING_LENGTH', z: 'INVALID_DIMENSION',
      x: 'INVALID_DIMENSION', big: 'DIMENSION_TOO_LARGE', junk: 'INVALID_DIMENSION',
    });
    expect(r.groups).toHaveLength(0);
    expect(r.grandTotal).toBe('0.00');
  });
  it('a zero rate means no rate', () => {
    expect(calculate([item({})], { tiles: rate('0', 'area') }, 'decimal').invalid[0].reason).toBe('NO_RATE');
  });
  it('a count of zero is invalid', () => {
    expect(calculate([item({ categoryKey: 'doors', count: 0 })], { doors: rate('5', 'count') }, 'decimal').invalid[0].reason).toBe('INVALID_COUNT');
  });
  it('good lines are still counted when others are bad', () => {
    const r = calculate([item({ id: 'ok' }), item({ id: 'bad', breadth: null })], { tiles: rate('1', 'area') }, 'decimal');
    expect(r.grandTotal).toBe('100.00');
    expect(r.invalid).toEqual([{ id: 'bad', reason: 'MISSING_BREADTH' }]);
  });
  it('a length rate ignores a junk breadth, an area rate does not', () => {
    expect(calculate([item({ breadth: 'abc' })], { tiles: rate('1', 'length') }, 'decimal').grandTotal).toBe('10.00');
  });
});

describe('calculate: lines the photo reader was unsure about', () => {
  it('are still counted, but reported as warnings so a person can check them', () => {
    const r = calculate(
      [item({ id: 'sure' }), item({ id: 'unsure', uncertain: true })],
      { tiles: rate('1', 'area') }, 'decimal',
    );
    expect(r.grandTotal).toBe('200.00');
    expect(r.warnings).toEqual([{ id: 'unsure', reason: 'CHECK_NUMBERS' }]);
    expect(r.groups[0].items.map((l) => l.check)).toEqual([false, true]);
  });
  it('a line that cannot be priced is invalid, not a warning', () => {
    const r = calculate([item({ id: 'x', uncertain: true, breadth: null })], { tiles: rate('1', 'area') }, 'decimal');
    expect(r.invalid).toEqual([{ id: 'x', reason: 'MISSING_BREADTH' }]);
    expect(r.warnings).toEqual([]);
  });
  it('no warnings when nothing is unsure', () => {
    expect(calculate([item({})], { tiles: rate('1', 'area') }, 'decimal').warnings).toEqual([]);
  });
});

