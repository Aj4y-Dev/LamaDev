import { parseMeasurementText } from './text-parser';

const one = (line: string) => parseMeasurementText(line)[0];

describe('parseMeasurementText', () => {
  it('reads label, length and breadth, keeping numbers as text', () => {
    expect(one('Hall 12.6 x 10.3 ft')).toEqual({ label: 'Hall', length: '12.6', breadth: '10.3', count: null, unit: 'ft' });
  });
  it('handles list numbering, X, × and * separators', () => {
    expect(one('1) Bedroom 14 X 9.8')).toMatchObject({ label: 'Bedroom', length: '14', breadth: '9.8' });
    expect(one('2. Kitchen 10×8')).toMatchObject({ label: 'Kitchen', length: '10', breadth: '8' });
    expect(one('Bath 6*5')).toMatchObject({ label: 'Bath', length: '6', breadth: '5' });
  });
  it('converts Nepali digits', () => {
    expect(one('हल १२.६ x १०.३')).toMatchObject({ label: 'हल', length: '12.6', breadth: '10.3' });
  });
  it('fixes common OCR slips inside numbers', () => {
    expect(one('Hall l2.6 x 1O.3')).toMatchObject({ length: '12.6', breadth: '10.3' });
    expect(one('Hall 10 . 6 x 9 , 3')).toMatchObject({ length: '10.6', breadth: '9.3' });
  });
  it('keeps written feet and inches as written', () => {
    expect(one(`Hall 14' 6" x 9' 8"`)).toMatchObject({ length: `14' 6"`, breadth: `9' 8"` });
  });
  it('reads a label with one size as a length', () => {
    expect(one('Passage 20.4 ft')).toEqual({ label: 'Passage', length: '20.4', breadth: null, count: null, unit: 'ft' });
  });
  it('reads counts', () => {
    expect(one('Doors 3 nos')).toEqual({ label: 'Doors', length: null, breadth: null, count: '3', unit: null });
  });
  it('detects metres', () => {
    expect(one('Hall 4 x 3.5 m')).toMatchObject({ unit: 'm' });
  });
  it('skips totals, page numbers, dates and noise', () => {
    const text = ['Total 4578.75', 'Page 1', 'Date: 12/10/2026', 'Rate 85', '~~~', '', 'Hall 10 x 10'].join('\n');
    expect(parseMeasurementText(text)).toHaveLength(1);
  });
  it('reads a whole page in order', () => {
    const text = 'Site measurements\nHall 12.6 x 10.3\nBedroom 14.0 x 9.8\nPassage 20.4\n';
    expect(parseMeasurementText(text).map((i) => i.label)).toEqual(['Hall', 'Bedroom', 'Passage']);
  });
});
