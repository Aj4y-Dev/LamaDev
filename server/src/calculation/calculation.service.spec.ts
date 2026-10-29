import { CalcItem, CalcRate, CalculationService } from './calculation.service';
import { parseDimension } from './dimension';
import { StrategyRegistry } from './strategies/strategy.registry';
import { D } from '../common/utils/decimal';

const svc = new CalculationService(new StrategyRegistry());
const rate = (value: string, per: 'area' | 'length' | 'count', label = 'Work'): CalcRate => ({ value: new D(value), per, label });
const item = (over: Partial<CalcItem>): CalcItem => ({ id: 'a', categoryKey: 'tiles', label: 'Hall', length: '10', breadth: '10', count: null, unit: 'ft', ...over });

const feet = (raw: string, mode: 'decimal' | 'feet_inches', unit: 'ft' | 'm' = 'ft') => {
  const r = parseDimension(raw, mode, unit);
  return r.ok ? r.feet.toFixed() : r.reason;
};

describe('parseDimension', () => {
  it('decimal mode reads 10.5 as 10.5 ft', () => expect(feet('10.5', 'decimal')).toBe('10.5'));
  it('feet_inches mode reads the digits after the dot as inches', () => {
    expect(feet('10.6', 'feet_inches')).toBe('10.5'); // 10 ft 6 in
    expect(feet('10.0', 'feet_inches')).toBe('10');
    expect(feet('10', 'feet_inches')).toBe('10');
  });
  it('feet_inches: 10.1 is 1 inch and 10.10 is 10 inches', () => {
    expect(new D(feet('10.1', 'feet_inches')).toDecimalPlaces(4).toFixed()).toBe('10.0833');
    expect(new D(feet('10.10', 'feet_inches')).toDecimalPlaces(4).toFixed()).toBe('10.8333');
  });
  it('feet_inches rejects 12 inches or more and long fractions', () => {
    expect(feet('10.12', 'feet_inches')).toBe('INVALID');
    expect(feet('10.125', 'feet_inches')).toBe('INVALID');
  });
  it('explicit feet-inches notation is read the same in both modes', () => {
    expect(feet(`14'6"`, 'decimal')).toBe('14.5');
    expect(feet(`14'6"`, 'feet_inches')).toBe('14.5');
    expect(feet('14-6', 'decimal')).toBe('14.5');
    expect(feet(`14' 6`, 'decimal')).toBe('14.5');
  });
  it('converts metres to feet and flags missing or bad input', () => {
    expect(feet('1', 'decimal', 'm')).toBe('3.28084');
    expect(feet('', 'decimal')).toBe('MISSING');
    expect(feet('abc', 'decimal')).toBe('INVALID');
  });
});

describe('CalculationService', () => {
  it('area: 14.5 x 4.5 x 15 = 978.75 exactly (no float drift)', () => {
    const r = svc.calculate([item({ length: '14.5', breadth: '4.5' })], { tiles: rate('15', 'area') }, 'decimal');
    expect(r.groups[0].items[0].qty).toBe('65.250');
    expect(r.groups[0].items[0].amount).toBe('978.75');
    expect(r.grandTotal).toBe('978.75');
  });

  it('feet_inches: 10.6 x 9.6 is 10.5 x 9.5 = 99.75 sq ft', () => {
    const r = svc.calculate([item({ length: '10.6', breadth: '9.6' })], { tiles: rate('10', 'area') }, 'feet_inches');
    expect(r.groups[0].items[0].qty).toBe('99.750');
    expect(r.groups[0].items[0].amount).toBe('997.50');
  });

  it('the same text gives different results in the two modes', () => {
    const a = svc.calculate([item({ length: '10.6', breadth: '10' })], { tiles: rate('1', 'area') }, 'decimal');
    const b = svc.calculate([item({ length: '10.6', breadth: '10' })], { tiles: rate('1', 'area') }, 'feet_inches');
    expect(a.grandTotal).toBe('106.00');
    expect(b.grandTotal).toBe('105.00');
  });

  it('rounds each line half-up at 2 decimals, and totals the rounded lines', () => {
    const r = svc.calculate(
      [item({ id: '1', length: '0.125', breadth: '1' }), item({ id: '2', length: '0.125', breadth: '1' })],
      { tiles: rate('1', 'area') }, 'decimal',
    );
    expect(r.groups[0].items.map((l) => l.amount)).toEqual(['0.13', '0.13']);
    expect(r.groups[0].subtotal).toBe('0.26');
    expect(r.grandTotal).toBe('0.26');
  });

  it('length and count strategies', () => {
    const r = svc.calculate(
      [item({ id: 'l', categoryKey: 'kora', length: '20', breadth: null }), item({ id: 'c', categoryKey: 'doors', count: 3 })],
      { kora: rate('30', 'length'), doors: rate('100', 'count') }, 'decimal',
    );
    expect(r.groups.map((g) => g.subtotal)).toEqual(['600.00', '300.00']);
    expect(r.grandTotal).toBe('900.00');
  });

  it('groups work types in order of first appearance and combines photos of one type', () => {
    const r = svc.calculate(
      [item({ id: '1', categoryKey: 'kora' }), item({ id: '2', categoryKey: 'tiles' }), item({ id: '3', categoryKey: 'kora' })],
      { kora: rate('2', 'area', 'Koramasino'), tiles: rate('3', 'area', 'Tiles') }, 'decimal',
    );
    expect(r.groups.map((g) => g.label)).toEqual(['Koramasino', 'Tiles']);
    expect(r.groups[0].items).toHaveLength(2);
    expect(r.grandTotal).toBe('700.00'); // 2 x 100 x 2 + 100 x 3
  });

  it('returns bad lines in invalid instead of dropping or guessing', () => {
    const r = svc.calculate(
      [
        item({ id: 'u', categoryKey: 'unknown' }),
        item({ id: 'n', categoryKey: 'nothing' }),
        item({ id: 'b', breadth: null }),
        item({ id: 'z', length: '0' }),
        item({ id: 'x', length: '10.12' }),
      ],
      { tiles: rate('10', 'area') }, 'feet_inches',
    );
    expect(Object.fromEntries(r.invalid.map((i) => [i.id, i.reason]))).toEqual({
      u: 'UNKNOWN_CATEGORY', n: 'NO_RATE', b: 'MISSING_BREADTH', z: 'INVALID_DIMENSION', x: 'INVALID_DIMENSION',
    });
    expect(r.groups).toHaveLength(0);
    expect(r.grandTotal).toBe('0.00');
  });

  it('shows the size as written', () => {
    const r = svc.calculate([item({ length: '10.8', breadth: '9.6' })], { tiles: rate('10', 'area') }, 'feet_inches');
    expect(r.groups[0].items[0].size).toBe('10.8 × 9.6');
  });
});
