import { D } from '../lib/decimal';
import { evaluateExpression } from './expression';

const q = (expr: string, per: 'area' | 'length' | 'count', mode: 'decimal' | 'feet_inches' = 'decimal', unit: 'ft' | 'm' = 'ft') => {
  const r = evaluateExpression(expr, per, mode, unit);
  return r.ok ? r.qty.n.div(r.qty.d).toFixed() : r.reason;
};

describe('evaluateExpression (area)', () => {
  it('A x B is length x breadth', () => {
    expect(q('13 x 11.9', 'area')).toBe('154.7');
    expect(q('5.9 x 1.2', 'area')).toBe('7.08');
  });
  it('a lone number is an area in sq ft', () => expect(q('35.6', 'area')).toBe('35.6'));
  it('terms joined with + are added', () => {
    expect(q('119.6 + 16.5', 'area')).toBe('136.1');
    expect(q('2 x 3 + 4', 'area')).toBe('10');
  });
  it('feet_inches mode reads the factors of a product as feet.inches, but a lone area stays decimal', () => {
    expect(q('10.6 x 10', 'area', 'feet_inches')).toBe('105'); // 10 ft 6 in x 10 ft
    expect(q('35.6', 'area', 'feet_inches')).toBe('35.6');
    expect(q('119.6 + 16.5', 'area', 'feet_inches')).toBe('136.1');
  });
  it('metres: factors are converted to feet, a lone area to sq ft', () => {
    expect(q('2 x 3', 'area', 'decimal', 'm')).toBe(new D('6').mul('10.7639111056').toFixed()); // 6 m2 in sq ft
    expect(q('1', 'area', 'decimal', 'm')).toBe('10.7639111056');
  });
  it('rejects what it cannot understand, and never guesses', () => {
    expect(q('2 x 3 x 4', 'area')).toBe('INVALID_EXPRESSION');
    expect(q('2 x', 'area')).toBe('INVALID_EXPRESSION');
    expect(q('+ 5', 'area')).toBe('INVALID_EXPRESSION');
    expect(q('abc', 'area')).toBe('INVALID_DIMENSION');
    expect(q('', 'area')).toBe('MISSING_EXPRESSION');
    expect(q('0 x 5', 'area')).toBe('INVALID_DIMENSION');
    expect(q('1000 x 5', 'area')).toBe('DIMENSION_TOO_LARGE');
    expect(q('300000', 'area')).toBe('DIMENSION_TOO_LARGE');
    expect(q('10.12 x 5', 'area', 'feet_inches')).toBe('INVALID_DIMENSION');
  });
});

describe('evaluateExpression (length and count)', () => {
  it('length: each term is one length, added together', () => {
    expect(q('12.5 + 3', 'length')).toBe('15.5');
    // 12 ft 6 in + 3 ft 4 in = 15 ft 10 in = 15.8333... ft
    expect(new D(q('12.6 + 3.4', 'length', 'feet_inches')).toDecimalPlaces(4).toFixed()).toBe('15.8333');
  });
  it('length: a product is not a length', () => expect(q('2 x 3', 'length')).toBe('INVALID_EXPRESSION'));
  it('count: whole numbers only', () => {
    expect(q('3 + 4', 'count')).toBe('7');
    expect(q('2.5', 'count')).toBe('INVALID_COUNT');
    expect(q('2 x 3', 'count')).toBe('INVALID_COUNT');
  });
});
