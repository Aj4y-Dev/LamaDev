# Estimator backend (plain Node.js + TypeScript)

Express 5, PostgreSQL 13+, no framework and no ORM. Photos are read with Tesseract (free, local,
no API key) and saved on this server's disk. All the maths uses exact decimals and fractions.

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

## Reading photos (Tesseract, free) - read this
- Works well on printed text or very neat block letters in even light (see the numbers in the benchmark notes).
- **Handwriting in a notebook is NOT read reliably.** On two real photos of a handwritten notebook page the
  reader got only 1 and 4 of 15 lines exactly right. Do not trust a total that comes straight from such a photo.
- So the reader is a helper, and a person always checks the lines before calculating:
  - lines it is unsure about are returned with `uncertain: true`;
  - `skippedLines` tells the app how many lines with digits on the photo could not be read at all;
  - a photo that cannot be read at all returns `EXTRACTION_FAILED`, and lines can be typed in by hand
    (start an estimate with `POST /projects/:id/estimates`, then `PUT /estimates/:id/items`).
- `EXTRACTION_MODE=mock` returns three fake lines for testing without a photo.

## What a line on the sheet can be
Each line is one calculation; all lines of a work type are added up, then multiplied by the rate:
- `13 x 11.9`: length x breadth (read with the calculation mode, so 11.9 can mean 11 ft 9 in)
- `35.6`: an area already worked out, in sq ft (always decimal)
- `119.6 + 16.5`: things added together
- `13 x 11.9 = 154.7`: the result the writer put after `=` is kept and compared with what we compute.
  If they differ the line is returned as a `RESULT_MISMATCH` warning. If they agree, the line is trusted.
- Anything else (for example `2 x 3 x 4`) is reported in `invalid`. It is never guessed.

## Two calculation modes (sent with `calculate`)
- `decimal` (normal): `10.5` means 10.5 ft.
- `feet_inches`: the digits after the dot are inches: `10.8` = 10 ft 8 in, `10.1` = 10 ft 1 in,
  `10.10` = 10 ft 10 in. More than 11 inches is reported as `INVALID_DIMENSION`.
- Written notation such as `14'6"` or `14-6` is always read as feet and inches. Metres are decimal.

## How money is calculated
For each work type: total quantity = all lines added together (exactly); amount = total quantity x rate,
rounded ONCE to 2 decimals (half up). Grand total = sum of the amounts. A line's own `amount` is shown for
information only. Example from the real notebook: 1273.65 sq ft x Rs 40 = Rs 50,946.00.
Sizes are kept as exact fractions and divided once at the end, so there is no rounding drift. A side longer than 500 ft is
reported as `DIMENSION_TOO_LARGE` (almost always a missing decimal point).

## Endpoints (base /api/v1; all except auth and /health need a Bearer token)
POST /auth/register, POST /auth/login, GET /users/me,
POST /projects, GET /projects, GET /projects/:id,
POST /projects/:id/estimates  (start an empty estimate, to type lines in by hand),
POST /projects/:id/estimates/extract  (multipart: image, categoryKey, optional estimateId; returns items and skippedLines),
GET /estimates/:id, PUT /estimates/:id/items,
POST /estimates/:id/calculate  (body: { mode?, rates: { <workKey>: { value, per, label } } }),
POST /estimates/:id/confirm

Success: `{ "data": ... }`. Error: `{ "error": { "code", "message", "details?" } }`.
