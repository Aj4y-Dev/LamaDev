import { ApiError } from '@google/genai';
import { GeminiVisionReader } from './gemini-vision-reader';
import { RateLimitedError } from './rate-limit-error';

const fakeGenerate = (...replies: string[]) => {
  const fn = jest.fn();
  for (const reply of replies) fn.mockResolvedValueOnce({ text: reply });
  return fn;
};
const reader = (generate: ReturnType<typeof fakeGenerate>) =>
  new GeminiVisionReader({ apiKey: 'test', model: 'gemini-3.8-flash' }, generate as never);

describe('GeminiVisionReader', () => {
  it('parses a clean JSON reply into raw items', async () => {
    const generate = fakeGenerate(JSON.stringify({
      items: [
        { label: 'Hall', length: '12.6', breadth: '10.3', count: null, unit: 'ft' },
        { label: 'Passage', length: '29', breadth: null, count: null, unit: null },
      ],
    }));
    const items = await reader(generate).read(Buffer.from('fake-jpeg'));
    expect(items).toEqual([
      { label: 'Hall', length: '12.6', breadth: '10.3', count: null, unit: 'ft' },
      { label: 'Passage', length: '29', breadth: null, count: null, unit: null },
    ]);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('strips ```json code fences before parsing', async () => {
    const generate = fakeGenerate('```json\n{"items":[{"label":"Hall","length":"10","breadth":null,"count":null,"unit":null}]}\n```');
    const items = await reader(generate).read(Buffer.from('fake-jpeg'));
    expect(items).toEqual([{ label: 'Hall', length: '10', breadth: null, count: null, unit: null }]);
  });

  it('retries once on malformed JSON, then succeeds if the second reply is valid', async () => {
    const generate = fakeGenerate('not json at all', JSON.stringify({ items: [{ label: 'Hall', length: '10', breadth: null, count: null, unit: null }] }));
    const items = await reader(generate).read(Buffer.from('fake-jpeg'));
    expect(items).toEqual([{ label: 'Hall', length: '10', breadth: null, count: null, unit: null }]);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('throws after two malformed replies, never calling the API more than twice', async () => {
    const generate = fakeGenerate('garbage', 'still garbage');
    await expect(reader(generate).read(Buffer.from('fake-jpeg'))).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('retries once on a transient 503 overload error, then succeeds', async () => {
    jest.useFakeTimers();
    try {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new ApiError({ message: 'overloaded', status: 503 }))
        .mockResolvedValueOnce({ text: JSON.stringify({ items: [{ label: 'Hall', length: '10', breadth: null, count: null, unit: null }] }) });
      const promise = reader(fn).read(Buffer.from('fake-jpeg'));
      await jest.advanceTimersByTimeAsync(2000);
      await expect(promise).resolves.toEqual([{ label: 'Hall', length: '10', breadth: null, count: null, unit: null }]);
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('gives up as RateLimitedError after its one retry on a persistent 503 — never more than 2 calls', async () => {
    jest.useFakeTimers();
    try {
      const fn = jest.fn().mockRejectedValue(new ApiError({ message: 'overloaded', status: 503 }));
      const promise = reader(fn).read(Buffer.from('fake-jpeg'));
      const expectation = expect(promise).rejects.toBeInstanceOf(RateLimitedError);
      await jest.advanceTimersByTimeAsync(2000);
      await expectation;
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('never retries a 429 (the free-tier quota will not reset within seconds) and throws RateLimitedError immediately', async () => {
    const fn = jest.fn().mockRejectedValue(new ApiError({ message: 'quota exceeded', status: 429 }));
    await expect(reader(fn).read(Buffer.from('fake-jpeg'))).rejects.toBeInstanceOf(RateLimitedError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry or wait on a non-transient error', async () => {
    const fn = jest.fn().mockRejectedValue(new ApiError({ message: 'bad request', status: 400 }));
    await expect(reader(fn).read(Buffer.from('fake-jpeg'))).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('sends the photo as inline base64 JPEG data and requests JSON output', async () => {
    const generate = fakeGenerate(JSON.stringify({ items: [] }));
    await reader(generate).read(Buffer.from('fake-jpeg-bytes'));
    const call = generate.mock.calls[0][0];
    expect(call.contents[0].parts[1]).toEqual({
      inlineData: { mimeType: 'image/jpeg', data: Buffer.from('fake-jpeg-bytes').toString('base64') },
    });
    expect(call.config.responseMimeType).toBe('application/json');
  });
});
