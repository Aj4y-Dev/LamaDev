import { ApiError, GoogleGenAI } from '@google/genai';
import type { ItemReader } from './item-reader';
import type { RawItem } from './normalizer';
import { RateLimitedError } from './rate-limit-error';
import { parseVisionJson, VISION_SYSTEM_PROMPT, VISION_USER_PROMPT } from './vision-prompt';

export interface GeminiVisionOptions {
  apiKey: string;
  model: string;
}

type GenerateContent = GoogleGenAI['models']['generateContent'];

/** One short retry for shared-capacity overload. Free tier quotas are typically only a handful of
 * requests per minute, so unlike the other readers, burning more than one extra call here on a single
 * photo makes quota exhaustion on the NEXT photo more likely, not less. */
const OVERLOAD_RETRY_MS = 2000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads a photo with a vision-capable Gemini model instead of local OCR. Same role as ClaudeVisionReader
 * (same prompt, same JSON contract, same read-only rule) behind the same ItemReader interface — this one
 * exists because the Gemini API has a free tier, for projects that cannot spend on a per-photo API cost.
 * A malformed JSON reply is retried once before giving up. A 429 (the free tier's per-minute quota, not
 * a per-photo problem) is never retried — it throws RateLimitedError immediately, since the quota will
 * not have reset a few seconds from now. A 503 (shared-capacity overload, unrelated to the quota) gets
 * exactly one short retry before also becoming RateLimitedError.
 */
export class GeminiVisionReader implements ItemReader {
  private readonly generateContent: GenerateContent;

  constructor(private readonly opts: GeminiVisionOptions, generateContent?: GenerateContent) {
    if (generateContent) {
      this.generateContent = generateContent;
    } else {
      const client = new GoogleGenAI({ apiKey: opts.apiKey });
      this.generateContent = client.models.generateContent.bind(client.models);
    }
  }

  async read(image: Buffer): Promise<RawItem[]> {
    let lastText = '';
    for (let attempt = 1; attempt <= 2; attempt++) {
      lastText = await this.askOnce(image);
      const items = parseVisionJson(lastText);
      if (items) return items;
    }
    throw new Error(`Vision model did not return valid JSON: ${lastText.slice(0, 200)}`);
  }

  private async askOnce(image: Buffer): Promise<string> {
    try {
      return await this.ask(image);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      if (err.status === 429) {
        throw new RateLimitedError("Gemini's free tier request limit for this minute is used up. Wait about a minute and try again.");
      }
      if (err.status === 503) {
        await sleep(OVERLOAD_RETRY_MS);
        try {
          return await this.ask(image);
        } catch {
          throw new RateLimitedError('Gemini is temporarily overloaded. Try again in a moment.');
        }
      }
      throw err;
    }
  }

  private async ask(image: Buffer): Promise<string> {
    const response = await this.generateContent({
      model: this.opts.model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: VISION_USER_PROMPT },
            { inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } },
          ],
        },
      ],
      config: {
        systemInstruction: VISION_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
      },
    });
    return response.text ?? '';
  }

  async close(): Promise<void> {
    // No persistent resources to release.
  }
}
