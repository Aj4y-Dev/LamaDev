import { z } from 'zod';
import type { RawItem } from './normalizer';

/** Shared by every vision-model reader (Claude, Gemini, ...) so the reading rules never drift between them. */
export const VISION_SYSTEM_PROMPT = `You read handwritten or printed construction measurement sheets for a Nepali contractor.
Return ONLY JSON, no markdown code fences, no commentary, matching exactly this shape:
{"items":[{"label":"string","length":"string or null","breadth":"string or null","count":"number or null","unit":"string or null"}]}

Rules:
- Read every measurement line on the page, top to bottom, in the order they appear.
- Keep every number EXACTLY as written, character for character (including Nepali digits) in "length"/"breadth".
  Never convert, round, simplify, or compute anything yourself — you only read, you never do arithmetic.
- A line with one number and no second dimension (for example "29" or "119.6") is already a complete
  measurement: put the number in "length" and leave "breadth" null. It is not a length waiting for a breadth.
- A line that already shows finished arithmetic with "=", like "119.6 + 16.5 = 136.1", has already been
  computed by hand: put ONLY the final number after the "=" ("136.1") in "length". Do not re-split it into
  the original addends, and do not output the addition as a separate line.
- A count line such as "3 nos" or "doors 5" goes in "count" (a number), with length and breadth null.
- "unit" is "ft" or "m" only if actually written near the numbers; otherwise null. Feet-inches notation
  such as 14'6" or 14-6 stays exactly as written in "length" — do not convert it to decimal feet.
- Use your best reading for the label even if the handwriting is messy; use an empty string if unreadable.
- Skip titles, dates, letterhead text, and already-summed page totals/grand totals — only individual
  measurement entries belong in "items".`;

/** What to ask the model to do with the photo, as plain text (separate from the system prompt so each
 * provider can place it as either the user turn or the system turn, per that SDK's conventions). */
export const VISION_USER_PROMPT = 'Read this photo and return only the JSON described in your instructions.';

const rawItemSchema = z.object({
  label: z.string().nullish(),
  length: z.union([z.string(), z.number()]).nullish(),
  breadth: z.union([z.string(), z.number()]).nullish(),
  count: z.union([z.string(), z.number()]).nullish(),
  unit: z.string().nullish(),
});
const visionResultSchema = z.object({ items: z.array(rawItemSchema) });

/** Strips ```json fences, parses, and validates against the expected shape. Returns null on any failure. */
export function parseVisionJson(text: string): RawItem[] | null {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch {
    return null;
  }
  const parsed = visionResultSchema.safeParse(json);
  if (!parsed.success) return null;
  return parsed.data.items.map((i) => ({
    label: i.label ?? '',
    length: i.length == null ? null : String(i.length),
    breadth: i.breadth == null ? null : String(i.breadth),
    count: i.count == null ? null : String(i.count),
    unit: i.unit ?? null,
  }));
}
