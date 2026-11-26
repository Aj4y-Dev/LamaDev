# Estimator backend (plain Node.js + TypeScript)

Express 5, PostgreSQL 13+, no framework and no ORM. Photos are read with Tesseract (free, local,
no API key) by default, or a vision model that reads handwriting reliably — Claude
(`EXTRACTION_MODE=claude`, pay-as-you-go, no subscription) or Gemini (`EXTRACTION_MODE=gemini`, has
a free tier). Photos are saved on this server's disk. All the maths uses exact decimals and fractions.

## Run it (development)
1. Start PostgreSQL: `docker compose up -d` (or use your own, or a hosted one with `DB_SSL=true`).
2. `pnpm install`, then `pnpm approve-builds` and allow `sharp` and `tesseract.js` if asked.
3. `copy .env.example .env` and set `DATABASE_URL` and `JWT_SECRET`.
4. `pnpm dev` -> API on http://localhost:3000/api/v1 (tables are created automatically on start).
5. Checks: `pnpm typecheck` and `pnpm test`.

## Run it on a VPS
```
pnpm install --prod=false && pnpm build
NODE_ENV=production pnpm start          # or: pm2 start dist/index.js --name estimator
```
- Put nginx or Caddy in front for HTTPS (Android release builds block plain http). The server already
  trusts one proxy hop. Keep port 3000 closed to the internet.
- Photos go to `UPLOAD_DIR` (default `./uploads`), as `<userId>/<estimateId>/<uuid>.jpg`.
  Use an absolute path in production and include it in your backups. It is not served over HTTP.
- Tesseract needs a few hundred MB of free RAM. The first photo after a start takes a few seconds.

## Reading photos
Four interchangeable readers, picked by `EXTRACTION_MODE`, all implementing the same `ItemReader`
interface (`extraction/item-reader.ts`) — swapping one for another never touches anything else. The
two vision readers share one prompt and JSON contract (`extraction/vision-prompt.ts`), so they read a
photo the same way regardless of which model answers.

- **`claude` (recommended if cost is not a concern — pay-as-you-go, no free tier).** Needs
  `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, default `claude-opus-5`). Not a subscription:
  a one-time prepaid balance at console.anthropic.com, billed per photo.
- **`gemini` (recommended if you want zero cost for light use).** Needs `GEMINI_API_KEY` (free at
  aistudio.google.com/apikey) and optionally `GEMINI_MODEL` (default `gemini-3.8-flash`). The free tier
  is real but narrow — as of writing, 5 requests per minute per model on a new project — so it is fine
  for one contractor testing the app, not for several people extracting photos at once. A 429 (quota
  used up) or 503 (shared-capacity overload) is never retried more than once, and is reported to the
  client as `RATE_LIMITED` ("too many requests, try again shortly") rather than `EXTRACTION_FAILED`
  ("could not read this photo") — the photo was fine, the model just couldn't answer right now. Retrying
  hard here would be counterproductive: it burns through an already-tiny per-minute budget faster, not slower.
- Both vision readers only ask the model to *read* each line, never to calculate — see
  `vision-prompt.ts` for the exact rules, including how a pre-added line like `119.6 + 16.5 = 136.1` is
  read as the single finished value `136.1`, and how a lone number like `29` is read as a complete
  measurement, not a length waiting for a breadth. A malformed (but successfully-received) reply is
  retried once, then reported as `EXTRACTION_FAILED`.
- **`tesseract` (default, free, local, no API key, no account needed).** Works well on printed or neat
  block-letter text. Tilt, shadows and uneven light are corrected automatically (deskew + per-photo
  adaptive black/white threshold). Six read attempts run per photo; the one with the most lines, fewest
  unsure numbers, and highest confidence wins, and any digit it's still unsure about is re-read from a
  3x zoomed-in crop restricted to digits only. This helps printed numbers and moderately messy
  handwriting, but it cannot make genuinely illegible handwriting reliable — that's a limit of the OCR
  model itself, not something preprocessing fixes. If real photos are mostly handwritten, use `claude`
  or `gemini` instead.
- **`mock`.** Returns three fake rooms, for testing without a photo or an API key.

Every line carries a confidence/uncertainty signal from whichever reader ran. Lines the reader is
unsure about are still counted, but are returned as `warnings` (and `check: true` on the line) so the
app can ask the user to double-check. Lines that cannot be priced go to `invalid` with a reason.
Nothing is dropped or guessed.

## Two calculation modes (sent with `calculate`)
- `decimal` (normal): `10.5` means 10.5 ft.
- `feet_inches`: the digits after the dot are inches: `10.8` = 10 ft 8 in, `10.1` = 10 ft 1 in,
  `10.10` = 10 ft 10 in. More than 11 inches is reported as `INVALID_DIMENSION`.
- Written notation such as `14'6"` or `14-6` is always read as feet and inches. Metres are decimal.

## How money is calculated
quantity (sq ft, ft or pieces) x rate, rounded once per line to 2 decimals (half up).
Subtotal = sum of the rounded lines. Grand total = sum of the subtotals. Sizes are kept as exact
fractions and divided once at the end, so there is no rounding drift. A side longer than 500 ft is
reported as `DIMENSION_TOO_LARGE` (almost always a missing decimal point).

An `area` line with only one number (no breadth) is priced as that number directly — a contractor
sometimes already knows a room's total square footage and writes it alone instead of two dimensions
to multiply, and that single number IS the area, not an incomplete entry. Only a missing *length* is
rejected (`MISSING_LENGTH`).

## Endpoints (base /api/v1; all except auth and /health need a Bearer token)
POST /auth/register, POST /auth/login, GET /users/me,
POST /projects, GET /projects, GET /projects/:id,
POST /projects/:id/estimates/extract  (multipart: image, categoryKey, optional estimateId),
GET /estimates/:id, PUT /estimates/:id/items,
POST /estimates/:id/calculate  (body: { mode?, rates: { <workKey>: { value, per, label } } }),
POST /estimates/:id/confirm

Success: `{ "data": ... }`. Error: `{ "error": { "code", "message", "details?" } }`.
