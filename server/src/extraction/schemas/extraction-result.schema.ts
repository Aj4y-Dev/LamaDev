import { z } from 'zod';

const textOrNumber = z.union([z.string(), z.number()]).nullish();

/** What we expect the model to return. The model output is untrusted input, so it is validated. */
export const extractionResultSchema = z.object({
  items: z
    .array(
      z.object({
        label: textOrNumber,
        length: textOrNumber,
        breadth: textOrNumber,
        count: textOrNumber,
        unit: z.string().nullish(),
      }),
    )
    .max(200),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/** Strips code fences and surrounding chatter, then parses JSON. Throws on failure. */
export function parseModelJson(text: string): unknown {
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}
