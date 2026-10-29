import { ExtractionService } from './extraction.service';
import { ExtractionProvider } from './providers/extraction-provider.interface';
import { extractionResultSchema, parseModelJson } from './schemas/extraction-result.schema';

const providerReturning = (...answers: (string | Error)[]): ExtractionProvider => {
  let i = 0;
  return {
    extract: async () => {
      const a = answers[Math.min(i++, answers.length - 1)];
      if (a instanceof Error) throw a;
      return a;
    },
  };
};
const good = JSON.stringify({ items: [{ label: 'Hall', length: '10.8', breadth: '9.6', unit: 'ft' }] });

describe('extraction schema', () => {
  it('strips code fences and chatter', () => {
    expect(parseModelJson('Here you go:\n```json\n{"items":[]}\n```')).toEqual({ items: [] });
  });
  it('rejects malformed model output', () => {
    expect(extractionResultSchema.safeParse({ items: 'nope' }).success).toBe(false);
    expect(extractionResultSchema.safeParse({ items: [{ length: { a: 1 } }] }).success).toBe(false);
  });
});

describe('ExtractionService', () => {
  it('returns validated items', async () => {
    const items = await new ExtractionService(providerReturning(good)).extractItems(Buffer.alloc(1));
    expect(items).toHaveLength(1);
  });
  it('retries once, then succeeds', async () => {
    const items = await new ExtractionService(providerReturning('not json', good)).extractItems(Buffer.alloc(1));
    expect(items).toHaveLength(1);
  });
  it('gives EXTRACTION_FAILED after two bad answers or when no items are found', async () => {
    await expect(new ExtractionService(providerReturning('bad', 'worse')).extractItems(Buffer.alloc(1))).rejects.toMatchObject({
      response: { code: 'EXTRACTION_FAILED' },
    });
    await expect(new ExtractionService(providerReturning('{"items":[]}')).extractItems(Buffer.alloc(1))).rejects.toMatchObject({
      response: { code: 'EXTRACTION_FAILED' },
    });
    await expect(new ExtractionService(providerReturning(new Error('timeout'))).extractItems(Buffer.alloc(1))).rejects.toMatchObject({
      response: { code: 'EXTRACTION_FAILED' },
    });
  });
});
