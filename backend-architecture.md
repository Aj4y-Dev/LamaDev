# Backend Architecture and Design Patterns

This document is a build spec for the backend of a construction estimator app. A coding agent should be able to follow it without asking questions. Anything marked **ASSUMPTION** is a default I picked and can be changed. Anything marked **OPEN** is undecided, so build it behind an interface and don't guess further.

---

## 1. Product context

Nepali contractors (thekadar) take or upload a photo of measurements (hand-written or printed, English and/or Nepali). The backend reads the photo, returns structured items, lets the client correct them, applies rates per work category, calculates costs, and returns grouped totals in Rs. The mobile client (React Native + Expo) builds the PDF/JPG itself from the API response.

The backend does three things:

1. Extract items from a photo (vision model).
2. Store projects, estimates, and rates.
3. Calculate costs. This is the only place the math happens.

**Core rule:** the AI model only reads the photo. It never does arithmetic. All calculation is done by our own code with exact decimals.

---

## 2. Stack

| Concern             | Choice                                                            |
| ------------------- | ----------------------------------------------------------------- |
| Runtime / framework | Node.js, NestJS (TypeScript, CommonJS)                            |
| Package manager     | pnpm (workspace with `client/` and `server/`)                     |
| Database            | PostgreSQL                                                        |
| ORM                 | TypeORM                                                           |
| Validation          | `class-validator` + `class-transformer` (global `ValidationPipe`) |
| Money math          | `decimal.js`                                                      |
| Uploads             | `multer` (memory storage) + `sharp`                               |
| Extraction          | Anthropic SDK, vision input, behind an interface                  |
| Auth                | JWT (access token), `@nestjs/jwt` + `@nestjs/passport`            |
| Config              | `@nestjs/config` with schema validation                           |
| File storage        | S3-compatible (Cloudflare R2 or S3) behind an interface           |
| Tests               | Jest (unit for calculation and normalizer, e2e for endpoints)     |

There is no shared package. The calculation engine lives only in `server/`.

---

## 3. Folder structure

```
server/src/
  main.ts
  app.module.ts
  common/
    decorators/            # @CurrentUser()
    filters/               # AllExceptionsFilter
    guards/                # JwtAuthGuard
    interceptors/          # response envelope, logging
    pipes/
    utils/
  config/
    configuration.ts
    env.validation.ts
  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    jwt.strategy.ts
    dto/
  users/
    users.module.ts
    users.service.ts
    user.entity.ts
  projects/
    projects.module.ts
    projects.controller.ts
    projects.service.ts
    project.entity.ts
    dto/
  estimates/
    estimates.module.ts
    estimates.controller.ts
    estimates.service.ts          # orchestrates the flow
    estimate.entity.ts
    estimate-item.entity.ts
    dto/
  extraction/
    extraction.module.ts
    extraction.service.ts         # uses the provider interface
    providers/
      extraction-provider.interface.ts
      claude-vision.provider.ts
    schemas/
      extraction-result.schema.ts # expected JSON shape + validation
    prompts/
      extract-items.prompt.ts
  normalizer/
    normalizer.module.ts
    normalizer.service.ts         # Nepali digits, units, feet-inches
  rates/
    rates.module.ts
    rates.controller.ts
    rates.service.ts
    rate.entity.ts
    dto/
  calculation/
    calculation.module.ts
    calculation.service.ts        # grouping, ordering, totals
    strategies/
      pricing-strategy.interface.ts
      area.strategy.ts
      length.strategy.ts
      count.strategy.ts
      strategy.registry.ts
    categories/
      category-order.ts           # fixed output order + labels
  storage/
    storage.module.ts
    storage.service.ts            # interface + S3 implementation
```

One folder per feature module. Modules only talk to each other through exported services, never through each other's repositories.

---

## 4. Design patterns to use

### 4.1 Layered modules (controller, service, repository)

- **Controller:** HTTP only. Parses DTOs, calls one service method, returns the result. No business logic.
- **Service:** business logic and orchestration.
- **Repository:** TypeORM repositories injected with `@InjectRepository`. Only the owning module's service touches its repository.

### 4.2 Strategy pattern for pricing

Each rate type is a class implementing one interface. The calculation service picks the strategy from the rate's `per` value through a registry. Adding a new measuring type means adding one class and registering it, with no changes to existing code.

```ts
export interface PricingStrategy {
  readonly type: RateType; // 'area' | 'length' | 'count'
  quantity(item: NormalizedItem): Decimal;
}
```

- `AreaStrategy`: length x breadth
- `LengthStrategy`: length
- `CountStrategy`: count (default 1)

Amount is always `quantity x rate.value`, computed in `CalculationService`, not in the strategies.

### 4.3 Adapter / provider pattern for extraction and storage

`ExtractionProvider` and `StorageService` are interfaces with a token injected through Nest's DI. The Claude vision call and the S3 client are implementations. Swapping the model or the storage vendor must not touch any service outside its own module.

```ts
export interface ExtractionProvider {
  extract(image: Buffer, mimeType: string): Promise<RawExtractionResult>;
}
export const EXTRACTION_PROVIDER = Symbol("EXTRACTION_PROVIDER");
```

### 4.4 Pipeline pattern for the extract endpoint

The extract flow is a fixed sequence of small steps, each with one job:

```
upload -> compress (sharp) -> provider.extract -> validate (schema)
       -> normalize -> persist draft estimate -> return items
```

`EstimatesService.extract()` calls these in order. Each step is a separate method or service so it can be tested alone.

### 4.5 DTO + validation at every boundary

- Every request body is a DTO class with `class-validator` decorators.
- The model's JSON output is also validated against a schema before use. Treat it as untrusted input.
- Enable `ValidationPipe` globally with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.

### 4.6 Pure functions for calculation and normalization

The calculation and normalizer code has no I/O and no database access. It takes plain objects and returns plain objects, so unit tests are trivial.

### 4.7 Snapshot rates onto the estimate

When an estimate is confirmed, copy the rate value and type into each `EstimateItem`. Later changes to a user's saved rates must not change old estimates.

### 4.8 Consistent response envelope and error handling

- Success: `{ "data": ..., "meta"?: ... }`
- Error: `{ "error": { "code": string, "message": string, "details"?: any } }`
- One global exception filter maps known errors to codes. Never leak stack traces or provider errors to the client.

---

## 5. Data model

All money columns are `numeric(14,2)`. All quantity and dimension columns are `numeric(12,3)`. TypeORM returns Postgres `numeric` as strings, so add a column transformer that converts to `Decimal` on read and to string on write. Never store money or dimensions as `float`.

```
User
  id (uuid, pk), phone (unique, nullable), email (unique, nullable),
  passwordHash (nullable), language ('en' | 'ne', default 'en'),
  createdAt, updatedAt

Project
  id (uuid, pk), userId (fk), title, clientName (nullable),
  createdAt, updatedAt

Rate                                   -- user's saved default rates
  id (uuid, pk), userId (fk), categoryKey, value numeric(14,2),
  per ('area' | 'length' | 'count'),
  unique (userId, categoryKey)

Estimate
  id (uuid, pk), projectId (fk), photoKey (nullable),
  status ('draft' | 'confirmed'),
  grandTotal numeric(14,2) (nullable until confirmed),
  createdAt, updatedAt

EstimateItem
  id (uuid, pk), estimateId (fk, on delete cascade),
  categoryKey, label,
  length numeric(12,3), breadth numeric(12,3) nullable, count int nullable,
  unit ('ft' | 'm'),
  qty numeric(12,3) nullable,          -- filled at calculation
  rateValue numeric(14,2) nullable,    -- snapshot
  rateType ('area' | 'length' | 'count') nullable,  -- snapshot
  amount numeric(14,2) nullable,
  sortIndex int
```

Index `Project.userId`, `Estimate.projectId`, `EstimateItem.estimateId`.

---

## 6. Categories and ordering

Defined in `calculation/categories/category-order.ts`. This list controls the order in every output.

```ts
export const CATEGORY_ORDER = [
  { key: "tiles_marble", label: "Tiles / Marble", labelNe: "टायल / मार्बल" },
  { key: "plaster", label: "Plaster", labelNe: "प्लास्टर" },
  { key: "koramasino", label: "Koramasino", labelNe: "कोरामसिनो" },
] as const;
```

- Items whose category is not in the list go into a final group named `other`, never dropped.
- Items with category `unknown` are not calculated until the client assigns a category.
- **OPEN:** what koramasino is and which measuring type (`per`) it uses. Until confirmed, treat it as `area`, and keep the choice in the rate record so it can change without code edits.

---

## 7. Calculation rules

1. Convert all dimensions to feet before calculating (the normalizer does this; the calculator only sees `ft`).
2. Quantity comes from the strategy for the item's rate type.
3. `amount = quantity x rate.value`, using `Decimal`.
4. Round only at the end of each line, to 2 decimals, using ROUND_HALF_UP. Do not round intermediate values.
5. Subtotal per category is the sum of its line amounts.
6. Grand total is the sum of the subtotals.
7. Reject a line (return it in `invalid`, do not calculate) if a required dimension is missing, zero, or negative, or if no rate is set for its category.

Worked example: 14.5 x 4.5 = 65.25 sq ft; 65.25 x 15 = Rs 978.75.

Response shape for calculate:

```json
{
  "data": {
    "groups": [
      {
        "categoryKey": "tiles_marble",
        "label": "Tiles / Marble",
        "labelNe": "टायल / मार्बल",
        "rate": { "value": "85.00", "per": "area" },
        "items": [
          {
            "id": "...",
            "label": "Bathroom",
            "qty": "30.000",
            "unit": "sqft",
            "amount": "2550.00"
          }
        ],
        "subtotal": "2550.00"
      }
    ],
    "invalid": [{ "id": "...", "reason": "MISSING_BREADTH" }],
    "grandTotal": "4578.75",
    "currency": "NPR"
  }
}
```

Money and quantities are returned as strings to avoid float problems on the client.

---

## 8. Normalizer rules

- Convert Nepali digits (०१२३४५६७८९) to 0-9.
- Parse feet-inches such as `14'6"`, `14' 6`, `14-6` into decimal feet (14.5).
- Accept `ft`, `feet`, `foot`, `m`, `meter`, `metre` and map to `ft` or `m`. Convert `m` to `ft` (1 m = 3.28084 ft) before calculation.
- Trim labels, collapse whitespace, keep Nepali text as is.
- Unknown or missing category becomes `unknown`.
- Land units (ropani, aana, dhur, paisa) are out of scope for the MVP.

---

## 9. API contract

Base path `/api/v1`. All routes except auth require `Authorization: Bearer <jwt>`. All ids are UUIDs. All routes check that the resource belongs to the current user.

| Method | Path                              | Purpose                                                                      |
| ------ | --------------------------------- | ---------------------------------------------------------------------------- |
| POST   | `/auth/register`                  | Create account, return JWT                                                   |
| POST   | `/auth/login`                     | Return JWT                                                                   |
| GET    | `/users/me`                       | Current user                                                                 |
| POST   | `/projects`                       | Create project                                                               |
| GET    | `/projects`                       | List own projects                                                            |
| GET    | `/projects/:id`                   | Project with its estimates                                                   |
| POST   | `/projects/:id/estimates/extract` | Multipart `image`; returns a draft estimate with items                       |
| GET    | `/estimates/:id`                  | Estimate with items                                                          |
| PUT    | `/estimates/:id/items`            | Replace the item list (user edits from the confirm screen)                   |
| POST   | `/estimates/:id/calculate`        | Body: optional per-job rate overrides; returns grouped totals, does not lock |
| POST   | `/estimates/:id/confirm`          | Snapshot rates, store amounts and grand total, set `confirmed`               |
| GET    | `/rates`                          | Own saved rates                                                              |
| PUT    | `/rates/:categoryKey`             | Create or update a saved rate                                                |

Upload limits: JPEG, PNG, or WebP; max 8 MB before compression. Compress with `sharp` to a max long edge of 2000 px, JPEG quality 80, before sending to the provider and before storing.

---

## 10. Extraction details

- The provider receives the compressed image and a prompt asking for JSON only, matching the schema in `extraction-result.schema.ts`.
- The prompt must list the allowed category keys and tell the model to use `unknown` when unsure, to keep Nepali labels as written, and never to calculate anything.
- Parse the response defensively: strip code fences, `JSON.parse`, then validate. On failure, retry once, then return `EXTRACTION_FAILED` so the client can switch to manual entry.
- Set a request timeout (30 s) and handle provider errors without leaking details.
- Model name and API key come from env vars, never hard-coded.

Expected raw result:

```json
{
  "items": [
    {
      "category": "plaster",
      "label": "Hall wall",
      "length": "20",
      "breadth": "10",
      "unit": "ft"
    }
  ]
}
```

Numbers may arrive as strings with Nepali digits, which is why normalization runs after validation.

---

## 11. Security and cost control

- The vision API key exists only in server env vars.
- Rate-limit the extract endpoint per user (`@nestjs/throttler`), for example 20 per hour. **ASSUMPTION:** adjust later from real usage.
- Hash passwords with argon2 or bcrypt. JWT secret from env, short expiry (**ASSUMPTION:** 7 days for the MVP, no refresh token yet).
- Store photos in a private bucket and return signed URLs, never public URLs.
- Do not log image bytes or full model responses. Log request ids, durations, and error codes.
- Use `helmet`, enable CORS only for known origins.

**OPEN:** login method. Phone OTP needs an SMS provider that works in Nepal. For the MVP, build email + password behind the `AuthService` interface so OTP can be added later.

---

## 12. Environment variables

```
NODE_ENV=
PORT=3000
DATABASE_URL=postgres://user:pass@host:5432/dbname
JWT_SECRET=
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
CORS_ORIGINS=
```

Validate these at startup and fail fast if any required one is missing. Provide a `.env.example` with no real values. `.env` is git-ignored.

---

## 13. Testing requirements

Unit tests (must pass before moving on):

- Each pricing strategy, including edge cases (zero, missing breadth, decimals).
- Money rounding: ROUND_HALF_UP at line level; sum of lines equals subtotal; no float drift (for example 14.5 x 4.5 x 15 = 978.75 exactly).
- Normalizer: Nepali digits, feet-inches, unit mapping, bad input.
- Category grouping: fixed order, `other` group, `unknown` excluded.
- Extraction schema validator: rejects malformed model output.

E2E tests:

- Register, login, create project, upload an image (mock the provider), edit items, calculate, confirm.
- A user cannot read or change another user's project, estimate, or rates.

Use a mocked `ExtractionProvider` in tests. Never call the real API in CI.

---

## 14. Build order for the agent

Do these in order and keep each step working before starting the next.

1. Config module with env validation, global `ValidationPipe`, response envelope, exception filter.
2. TypeORM connection and migrations (no `synchronize` outside local dev). Entities from section 5.
3. `users` and `auth` (register, login, JWT guard, `@CurrentUser`).
4. `projects` CRUD scoped to the current user.
5. `normalizer` with unit tests.
6. `calculation` (strategies, registry, grouping, totals) with unit tests.
7. `rates` module.
8. `extraction` with the provider interface, the Claude implementation, schema validation, and a mock provider for tests.
9. `storage` module with the S3 implementation.
10. `estimates` orchestration: extract, edit items, calculate, confirm.
11. Throttling, helmet, CORS, logging.
12. E2E tests and a short README covering setup and the env vars.

---

## 15. Out of scope for the MVP

Phone OTP login, refresh tokens, land-unit conversion, brick/cement/rebar quantity formulas, wastage and wall-thickness conditions, district-wise rates, background job queue, server-side PDF generation, and admin features.

---

## 16. Definition of done

- All endpoints in section 9 work and are covered by tests.
- Calculation results match hand-computed examples exactly.
- No endpoint exposes another user's data.
- The app starts with only the documented env vars set.
- Lint passes and there are no `any` types in the calculation and normalizer modules.
