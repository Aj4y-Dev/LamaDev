import { parseMeasurementLine, parseMeasurementText } from './text-parser';

const one = (line: string) => parseMeasurementLine(line);
const exprs = (text: string) => parseMeasurementText(text).map((i) => i.expr);

describe('labelled lines', () => {
  it('reads label, expression, length and breadth as text', () => {
    expect(one('Hall 12.6 x 10.3 ft')).toMatchObject({ label: 'Hall', expr: '12.6 x 10.3', length: '12.6', breadth: '10.3', unit: 'ft', written: null });
  });
  it('handles list numbering, X, × and * separators', () => {
    expect(one('1) Bedroom 14 X 9.8')).toMatchObject({ label: 'Bedroom', expr: '14 x 9.8' });
    expect(one('2. Kitchen 10×8')).toMatchObject({ label: 'Kitchen', expr: '10 x 8' });
    expect(one('Bath 6*5')).toMatchObject({ label: 'Bath', expr: '6 x 5' });
  });
  it('converts Nepali digits', () => {
    expect(one('हल १२.६ x १०.३')).toMatchObject({ label: 'हल', expr: '12.6 x 10.3' });
  });
  it('fixes common OCR slips inside numbers', () => {
    expect(one('Hall l2.6 x 1O.3')).toMatchObject({ expr: '12.6 x 10.3' });
    expect(one('Hall 10 . 6 x 9 , 3')).toMatchObject({ expr: '10.6 x 9.3' });
  });
  it('keeps written feet and inches as written', () => {
    expect(one(`Hall 14' 6" x 9' 8"`)).toMatchObject({ expr: `14' 6" x 9' 8"`, length: `14' 6"`, breadth: `9' 8"` });
  });
  it('reads a label with one size', () => {
    expect(one('Passage 20.4 ft')).toMatchObject({ label: 'Passage', expr: '20.4', length: '20.4', breadth: null, unit: 'ft' });
  });
  it('reads counts', () => {
    expect(one('Doors 3 nos')).toMatchObject({ label: 'Doors', expr: null, count: '3' });
  });
  it('detects metres', () => expect(one('Hall 4 x 3.5 m')).toMatchObject({ expr: '4 x 3.5', unit: 'm' }));
});

describe('noise is dropped, never guessed', () => {
  it('skips totals, page numbers, dates and paperwork', () => {
    const text = ['Total 4578.75', 'Page 1', 'Date: 12/10/2026', 'Rate 85', '~~~', '', 'Hall 10 x 10'].join('\n');
    expect(exprs(text)).toEqual(['10 x 10']);
  });
  it('drops two-letter scraps with a lone number, keeps a real pair', () => {
    expect(parseMeasurementText('Ux 12.5\noA 14')).toHaveLength(0);
    expect(parseMeasurementText('WC 12.5 x 6')).toHaveLength(1);
  });
  it('drops a line whose start was damaged ("Jey x 1.5")', () => expect(one('Jey x 1.5')).toBeNull());
  it('drops lines that are not expressions', () => {
    expect(one('19.9 Xx R')).toBeNull();
    expect(one('1.92 ¥x 2.7%')).toBeNull();
    expect(one('Tile / Marbal')).toBeNull();
    expect(one('www.hcoe.edu.np')).toBeNull();
    expect(one('0')).toBeNull();
    expect(one('9876543210')).toBeNull();
  });
});

// The two notebook pages from the real project: Tile / Marble, rate 40.
const PAGE_1 = `HIMALAYA
COLLEGE OF ENGINEERING
DATE
Tile / Marbal
1.4 x 1.5
29
13 x 11.9
5.9 x 1.2
12.2 x 3
1.9 x 2.7
35.6
9
119.6
119.6 + 16.5
36 x 14.6
9 x 18
10
8.2 x 2.7
19`;
const EXPECTED = ['1.4 x 1.5', '29', '13 x 11.9', '5.9 x 1.2', '12.2 x 3', '1.9 x 2.7', '35.6', '9', '119.6', '119.6 + 16.5', '36 x 14.6', '9 x 18', '10', '8.2 x 2.7', '19'];

describe('the notebook sheet', () => {
  it('reads all 15 lines of page 1 in order, and ignores the printed header', () => {
    expect(exprs(PAGE_1)).toEqual(EXPECTED);
  });
  it('reads handwriting style: raised dots and tight x', () => {
    const text = '1·4 x 1·5\n5·9 x 1·2\n36X14.6\n9x18\n119.6+16.5';
    expect(exprs(text)).toEqual(['1.4 x 1.5', '5.9 x 1.2', '36 x 14.6', '9 x 18', '119.6 + 16.5']);
  });
  it('reads the written results of page 2 and ignores the total lines', () => {
    const page2 = `Tile / Marbal
1.4 x 1.5 = 2.1
29
13 x 11.9 = 154.7
119.6 + 16.5 = 136.1
8.2 x 2.7 = 22.14
19
Tobal square = 1273.65 sq
Total amount of Tile / Marbal
= 1273.65 x 40 = RS 50946`;
    const items = parseMeasurementText(page2);
    expect(items.map((i) => [i.expr, i.written])).toEqual([
      ['1.4 x 1.5', '2.1'], ['29', null], ['13 x 11.9', '154.7'], ['119.6 + 16.5', '136.1'], ['8.2 x 2.7', '22.14'], ['19', null],
    ]);
  });
});
