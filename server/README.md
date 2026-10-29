# Estimator backend (NestJS 11 + PostgreSQL)

Reads photos of measurements, keeps estimates, and does ALL the maths with exact decimals.
Photos are read with Tesseract (free, local OCR, no API key). It only reads text. It never calculates.

## Run it
1. Start PostgreSQL (pick one):
   - Docker: `docker compose up -d`
   - Or install PostgreSQL locally, or use a free hosted one (Neon, Supabase) and set `DB_SSL=true`.
2. `pnpm install`  (if pnpm blocks a build script, run `pnpm approve-builds` and allow `sharp`)
3. `copy .env.example .env` and edit `DATABASE_URL` and `JWT_SECRET`.
4. `pnpm start:dev`  -> API on http://localhost:3000/api/v1 (tables are created automatically in development)
5. Test: `pnpm test` and `pnpm typecheck`

## Reading photos (Tesseract, free)
- Nothing to sign up for. The English and Nepali language data is installed by `pnpm install`.
- `EXTRACTION_MODE=tesseract` (default) reads real photos. `EXTRACTION_MODE=mock` returns three fake rooms.
- `TESSERACT_LANGS=eng+nep` reads English and Nepali. Use `eng` for faster, slightly cleaner digits.
- The first photo after the server starts takes a few seconds (Tesseract loads). Later photos are faster.
- Works well on printed or neat block-letter lines such as `Hall 12.6 x 10.3 ft`. Cursive handwriting is not reliable.
- Each line is read as: label, length x breadth, unit. `Passage 20.4` is a length only, and `Doors 3 nos` is a count.
- Lines that are not measurements (totals, page numbers, dates) are skipped.

## Two calculation modes (sent with `calculate`)
- `decimal` (normal): `10.5` means 10.5 ft.
- `feet_inches`: the digits after the dot are inches. `10.8` = 10 ft 8 in, `10.1` = 10 ft 1 in,
  `10.10` = 10 ft 10 in. More than 11 inches is reported as `INVALID_DIMENSION`.
- Written notation such as `14'6"` or `14-6` is always read as feet and inches, in both modes.

## Endpoints (base /api/v1, all except auth need a Bearer token)
POST /auth/register, POST /auth/login, GET /users/me,
POST /projects, GET /projects, GET /projects/:id,
POST /projects/:id/estimates/extract  (multipart: image, categoryKey, optional estimateId),
GET /estimates/:id, PUT /estimates/:id/items,
POST /estimates/:id/calculate  (body: { mode?, rates: { <workKey>: { value, per, label } } }),
POST /estimates/:id/confirm

Success: `{ "data": ... }`. Error: `{ "error": { "code", "message", "details?" } }`.

## Production
Set `NODE_ENV=production`, then generate the first migration once against an empty database:
`pnpm migration:generate src/migrations/Init` and `pnpm migration:run`.
