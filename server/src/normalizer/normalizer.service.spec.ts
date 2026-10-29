import { NormalizerService } from './normalizer.service';

const n = new NormalizerService();

describe('NormalizerService', () => {
  it('converts Nepali digits', () => expect(n.toAsciiDigits('१०.८')).toBe('10.8'));
  it('keeps size text as written and tidies quotes', () => {
    expect(n.normalizeDimensionText('१०.८')).toBe('10.8');
    expect(n.normalizeDimensionText('14’ 6”')).toBe(`14' 6"`);
    expect(n.normalizeDimensionText('10,8')).toBe('10.8');
    expect(n.normalizeDimensionText('  ')).toBeNull();
    expect(n.normalizeDimensionText(null)).toBeNull();
  });
  it('maps units and defaults to ft', () => {
    expect(n.normalizeUnit('Meter')).toBe('m');
    expect(n.normalizeUnit('feet')).toBe('ft');
    expect(n.normalizeUnit(undefined)).toBe('ft');
  });
  it('cleans labels and counts', () => {
    expect(n.normalizeLabel('  Hall   wall ')).toBe('Hall wall');
    expect(n.normalizeCount('३')).toBe(3);
    expect(n.normalizeCount('x')).toBeNull();
  });
  it('builds a draft item for the chosen work type', () => {
    expect(n.normalizeExtractedItem({ label: 'Hall', length: 10.8, breadth: '9.6', unit: 'ft' }, 'tiles')).toEqual({
      categoryKey: 'tiles', label: 'Hall', length: '10.8', breadth: '9.6', count: null, unit: 'ft',
    });
  });
});
