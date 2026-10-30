import { normalizeCount, normalizeDimensionText, normalizeExtractedItem, normalizeLabel, normalizeUnit, toAsciiDigits } from './normalizer';

describe('normalizer', () => {
  it('converts Nepali digits', () => expect(toAsciiDigits('१०.८')).toBe('10.8'));
  it('keeps size text as written and tidies quotes', () => {
    expect(normalizeDimensionText('१०.८')).toBe('10.8');
    expect(normalizeDimensionText('14’ 6”')).toBe(`14' 6"`);
    expect(normalizeDimensionText('10,8')).toBe('10.8');
    expect(normalizeDimensionText('  ')).toBeNull();
    expect(normalizeDimensionText(null)).toBeNull();
    expect(normalizeDimensionText(10.8)).toBe('10.8');
  });
  it('maps units and defaults to ft', () => {
    expect(normalizeUnit('Meter')).toBe('m');
    expect(normalizeUnit('feet')).toBe('ft');
    expect(normalizeUnit(undefined)).toBe('ft');
  });
  it('cleans labels and counts', () => {
    expect(normalizeLabel('  Hall   wall ')).toBe('Hall wall');
    expect(normalizeCount('३')).toBe(3);
    expect(normalizeCount('x')).toBeNull();
  });
  it('builds a draft item for the chosen work type', () => {
    expect(normalizeExtractedItem({ label: 'Hall', length: 10.8, breadth: '9.6', unit: 'ft' }, 'tiles')).toEqual({
      categoryKey: 'tiles', label: 'Hall', length: '10.8', breadth: '9.6', count: null, unit: 'ft', uncertain: false,
    });
  });
});
