import Anthropic from '@anthropic-ai/sdk';
import type { ItemReader } from './item-reader';
import type { RawItem } from './normalizer';
import { RateLimitedError } from './rate-limit-error';
import { parseVisionJson, VISION_SYSTEM_PROMPT, VISION_USER_PROMPT } from './vision-prompt';

export interface ClaudeVisionOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

/**
 * Reads a photo with a vision-capable Claude model instead of local OCR. Unlike Tesseract, it reads
 * handwriting reliably, at the cost of a per-photo API call. The model only reads: all arithmetic still
 * happens in calculation.ts. A malformed JSON reply is retried once before giving up (never thrown raw;
 * readItems() in extraction.service.ts turns a thrown error into EXTRACTION_FAILED for the client).
 * The SDK itself already retries 429/5xx a couple of times with backoff; a RateLimitError that survives
 * that becomes our own RateLimitedError, so readItems() gives the client an honest "wait and retry"
 * message instead of blaming the photo.
 */
export class ClaudeVisionReader implements ItemReader {
  private readonly client: Pick<Anthropic, 'messages'>;

  constructor(private readonly opts: ClaudeVisionOptions, client?: Pick<Anthropic, 'messages'>) {
    this.client = client ?? new Anthropic({ apiKey: opts.apiKey, timeout: opts.timeoutMs ?? 30_000 });
  }

  async read(image: Buffer): Promise<RawItem[]> {
    let lastText = '';
    for (let attempt = 1; attempt <= 2; attempt++) {
      lastText = await this.ask(image);
      const items = parseVisionJson(lastText);
      if (items) return items;
    }
    throw new Error(`Vision model did not return valid JSON: ${lastText.slice(0, 200)}`);
  }

  private async ask(image: Buffer): Promise<string> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.opts.model,
        max_tokens: 4096,
        system: VISION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.toString('base64') } },
              { type: 'text', text: VISION_USER_PROMPT },
            ],
          },
        ],
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        throw new RateLimitedError("Claude's request limit was hit. Wait a moment and try again.");
      }
      throw err;
    }
    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return block?.text ?? '';
  }

  async close(): Promise<void> {
    // No persistent resources to release (unlike TesseractReader's worker).
  }
}
