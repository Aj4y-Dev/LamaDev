import { readItems } from './extraction.service';
import type { ItemReader } from './item-reader';

const reader = (...answers: (object[] | Error)[]): ItemReader => {
  let i = 0;
  return {
    read: async () => {
      const a = answers[Math.min(i++, answers.length - 1)];
      if (a instanceof Error) throw a;
      return a;
    },
  };
};
const one = [{ label: 'Hall', length: '10.8', breadth: '9.6' }];

describe('readItems', () => {
  it('returns items', async () => expect(await readItems(reader(one), Buffer.alloc(1))).toHaveLength(1));
  it('retries once if the reader crashes', async () => expect(await readItems(reader(new Error('x'), one), Buffer.alloc(1))).toHaveLength(1));
  it('gives EXTRACTION_FAILED when nothing is found, without retrying', async () => {
    let calls = 0;
    const r: ItemReader = { read: async () => { calls++; return []; } };
    await expect(readItems(r, Buffer.alloc(1))).rejects.toMatchObject({ code: 'EXTRACTION_FAILED', status: 422 });
    expect(calls).toBe(1);
  });
  it('gives EXTRACTION_FAILED when the reader keeps crashing', async () => {
    await expect(readItems(reader(new Error('boom')), Buffer.alloc(1))).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' });
  });
});
