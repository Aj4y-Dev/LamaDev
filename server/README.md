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

## Reading photos
- Works best on printed or neat block-letter lines such as `Hall 12.6 x 10.3 ft`, in even light.
  Tilt, shadows and blur are corrected. Cursive handwriting is not reliable.
- Every line carries Tesseract's confidence. Lines it is unsure about are still counted, but are
  returned as `warnings` (and `check: true` on the line) so the app can ask the user to double-check.
- Lines that cannot be priced go to `invalid` with a reason. Nothing is dropped or guessed.
- `EXTRACTION_MODE=mock` returns three fake rooms for testing without a photo.

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

## Endpoints (base /api/v1; all except auth and /health need a Bearer token)
POST /auth/register, POST /auth/login, GET /users/me,
POST /projects, GET /projects, GET /projects/:id,
POST /projects/:id/estimates/extract  (multipart: image, categoryKey, optional estimateId),
GET /estimates/:id, PUT /estimates/:id/items,
POST /estimates/:id/calculate  (body: { mode?, rates: { <workKey>: { value, per, label } } }),
POST /estimates/:id/confirm

Success: `{ "data": ... }`. Error: `{ "error": { "code", "message", "details?" } }`.
