import { readItems } from './extraction.service';
import type { ItemReader, ReadResult } from './item-reader';

const reader = (...answers: (ReadResult | Error)[]): ItemReader => {
  let i = 0;
  return {
    read: async () => {
      const a = answers[Math.min(i++, answers.length - 1)];
      if (a instanceof Error) throw a;
      return a;
    },
  };
};
const one: ReadResult = { items: [{ label: 'Hall', expr: '10.8 x 9.6' }], skipped: 2 };

describe('readItems', () => {
  it('returns items and how many lines could not be read', async () => {
    const r = await readItems(reader(one), Buffer.alloc(1));
    expect(r.items).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });
  it('retries once if the reader crashes', async () => expect((await readItems(reader(new Error('x'), one), Buffer.alloc(1))).items).toHaveLength(1));
  it('gives EXTRACTION_FAILED when nothing is found, without retrying', async () => {
    let calls = 0;
    const r: ItemReader = { read: async () => { calls++; return { items: [], skipped: 3 }; } };
    await expect(readItems(r, Buffer.alloc(1))).rejects.toMatchObject({ code: 'EXTRACTION_FAILED', status: 422 });
    expect(calls).toBe(1);
  });
  it('gives EXTRACTION_FAILED when the reader keeps crashing', async () => {
    await expect(readItems(reader(new Error('boom')), Buffer.alloc(1))).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' });
  });
});
