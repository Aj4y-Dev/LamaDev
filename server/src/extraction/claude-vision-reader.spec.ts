import Anthropic from '@anthropic-ai/sdk';
import { ClaudeVisionReader } from './claude-vision-reader';
import { RateLimitedError } from './rate-limit-error';

const textBlock = (text: string) => ({ type: 'text' as const, text });
const fakeClient = (...replies: string[]) => {
  const create = jest.fn();
  for (const reply of replies) create.mockResolvedValueOnce({ content: [textBlock(reply)] });
  return { messages: { create } };
};
const reader = (client: ReturnType<typeof fakeClient>) =>
  new ClaudeVisionReader({ apiKey: 'test', model: 'claude-opus-5' }, client as never);

describe('ClaudeVisionReader', () => {
  it('parses a clean JSON reply into raw items', async () => {
    const client = fakeClient(JSON.stringify({
      items: [
        { label: 'Hall', length: '12.6', breadth: '10.3', count: null, unit: 'ft' },
        { label: 'Passage', length: '29', breadth: null, count: null, unit: null },
      ],
    }));
    const items = await reader(client).read(Buffer.from('fake-jpeg'));
    expect(items).toEqual([
      { label: 'Hall', length: '12.6', breadth: '10.3', count: null, unit: 'ft' },
      { label: 'Passage', length: '29', breadth: null, count: null, unit: null },
    ]);
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it('strips ```json code fences before parsing', async () => {
    const client = fakeClient('```json\n{"items":[{"label":"Hall","length":"10","breadth":null,"count":null,"unit":null}]}\n```');
    const items = await reader(client).read(Buffer.from('fake-jpeg'));
    expect(items).toEqual([{ label: 'Hall', length: '10', breadth: null, count: null, unit: null }]);
  });

  it('coerces numeric length/count to strings, keeping numbers as text', async () => {
    const client = fakeClient(JSON.stringify({ items: [{ label: 'Doors', length: null, breadth: null, count: 3, unit: null }] }));
    const items = await reader(client).read(Buffer.from('fake-jpeg'));
    expect(items).toEqual([{ label: 'Doors', length: null, breadth: null, count: '3', unit: null }]);
  });

  it('retries once on malformed JSON, then succeeds if the second reply is valid', async () => {
    const client = fakeClient('not json at all', JSON.stringify({ items: [{ label: 'Hall', length: '10', breadth: null, count: null, unit: null }] }));
    const items = await reader(client).read(Buffer.from('fake-jpeg'));
    expect(items).toEqual([{ label: 'Hall', length: '10', breadth: null, count: null, unit: null }]);
    expect(client.messages.create).toHaveBeenCalledTimes(2);
  });

  it('throws after two malformed replies, never calling the real API more than twice', async () => {
    const client = fakeClient('garbage', 'still garbage');
    await expect(reader(client).read(Buffer.from('fake-jpeg'))).rejects.toThrow();
    expect(client.messages.create).toHaveBeenCalledTimes(2);
  });

  it('rejects a reply that is valid JSON but the wrong shape', async () => {
    const client = fakeClient(JSON.stringify({ rooms: [] }), JSON.stringify({ rooms: [] }));
    await expect(reader(client).read(Buffer.from('fake-jpeg'))).rejects.toThrow();
  });

  it('maps a RateLimitError from the SDK to our own RateLimitedError, without retrying', async () => {
    const create = jest.fn().mockRejectedValue(new Anthropic.RateLimitError(429, {}, 'slow down', new Headers()));
    const client = { messages: { create } };
    await expect(reader(client).read(Buffer.from('fake-jpeg'))).rejects.toBeInstanceOf(RateLimitedError);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('sends the photo as a base64 JPEG and never does arithmetic in the prompt response', async () => {
    const client = fakeClient(JSON.stringify({ items: [] }));
    await reader(client).read(Buffer.from('fake-jpeg-bytes'));
    const call = client.messages.create.mock.calls[0][0];
    expect(call.messages[0].content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from('fake-jpeg-bytes').toString('base64') },
    });
  });
});
