# Construction Estimator App: Design Structure

**Stack:** React Native + Expo + TypeScript (mobile), NestJS + PostgreSQL (backend)

A mobile app for Nepali thekadars (contractors). The user takes or uploads a photo of measurements, the app reads them, applies rates per work category, and produces a finished estimate in Rs as a PDF or JPG.

---

## 1. What the app does

The photo can be a hand-drawn plan or a notebook page, with text in English, Nepali, or both. The app extracts the numbers, lets the user confirm them, applies a rate for each category (tiles/marble, plaster, koramasino, and so on), and exports a clean estimate grouped in a fixed order.

**Who it's for:** contractors who know the work well but don't have time, or the math comfort, to calculate every job by hand.

**One line:** photo in, confirmed numbers, rates applied, PDF/JPG out.

---

## 2. User flow

1. Open the app and pick a project (or create one).
2. Take a photo or choose one from the gallery.
3. The app uploads it and shows the extracted items in an editable table.
4. The user fixes any wrong number or category.
5. The user checks the rate for each category (pre-filled from saved rates, editable per job).
6. Tap Calculate and see the grouped result.
7. Export as PDF or JPG and share, mainly through WhatsApp.

The confirm step (4) matters most. Handwriting gets misread, and one wrong digit ruins the total.

---

## 3. Architecture

```
[ Expo app (React Native + TypeScript) ]
   |-- capture (camera / gallery)
   |-- compress image on device
   |-- confirm + edit screen
   |-- calculation (shared TS package)
   |-- PDF / JPG export on device
   |
   |  HTTPS (JWT)
   v
[ NestJS API ]
   |-- auth            (phone OTP or email, JWT)
   |-- extraction      (Claude vision -> structured JSON)
   |-- normalizer      (Nepali digits, units, feet-inches)
   |-- projects / estimates / rates
   |
[ PostgreSQL ]   [ Object storage: R2 / S3 / Cloudinary ]
```

**Key rule:** the AI only reads the photo. All math is done by our own code, so results are predictable and testable.

**Shared package:** the calculation engine lives in `packages/shared` and is imported by both the app and the API. The app uses it for instant results, the API can use it to re-check totals.

---

## 4. Tech stack

### Mobile app

| Part            | Choice                                      |
| --------------- | ------------------------------------------- |
| Framework       | React Native + Expo (TypeScript)            |
| Navigation      | Expo Router                                 |
| Capture         | `expo-camera` or `expo-image-picker`        |
| Image resize    | `expo-image-manipulator`                    |
| PDF             | `expo-print` (HTML to PDF)                  |
| Share           | `expo-sharing`                              |
| JPG export      | `react-native-view-shot`                    |
| Server state    | TanStack Query                              |
| Local state     | Zustand                                     |
| Offline storage | `expo-sqlite` or MMKV (saved rates, drafts) |
| Money math      | `decimal.js`                                |
| Language        | `i18next` (English and Nepali UI)           |

### Backend

| Part          | Choice                           | Why                                                 |
| ------------- | -------------------------------- | --------------------------------------------------- |
| Framework     | NestJS                           | Clear modules, built-in validation and DI           |
| Database      | PostgreSQL                       | Relational data, exact decimals for money           |
| ORM           | Prisma or TypeORM                | Typed queries and migrations                        |
| Validation    | zod or class-validator           | Check the model's JSON before calculating           |
| Extraction    | Claude vision API                | Reads handwriting, Nepali and English, returns JSON |
| Uploads       | multer + sharp                   | Receive and compress images                         |
| Storage       | Cloudflare R2, S3, or Cloudinary | Photos and exported files                           |
| Auth          | JWT with phone OTP or email      | Phone login suits Nepali users                      |
| Queue (later) | BullMQ + Redis                   | Only if extraction gets slow                        |

### Hosting

Railway or Render for the API, Neon or Supabase for Postgres, Cloudflare R2 for files.

---

## 5. Pipeline in detail

### 5.1 Capture and compress (app)

Take the photo, then resize and compress it with `expo-image-manipulator` before upload. Mobile data is slow, so aim for well under 1 MB.

### 5.2 Extraction (API)

The API sends the image to the vision model with a strict JSON schema. The model picks the category from a fixed list. If it can't tell, it returns `unknown` and the user chooses in the confirm screen.

```json
{
  "items": [
    {
      "category": "tiles_marble",
      "label": "Bathroom",
      "length": 6,
      "breadth": 5,
      "unit": "ft"
    },
    {
      "category": "plaster",
      "label": "Hall wall",
      "length": 20,
      "breadth": 10,
      "unit": "ft"
    },
    {
      "category": "koramasino",
      "label": "Kitchen",
      "length": 10,
      "breadth": 8,
      "unit": "ft"
    }
  ]
}
```

### 5.3 Normalization (our code, not the AI)

- Convert Nepali numerals (०१२३४५६७८९) to normal digits.
- Convert feet-inches (`14'6"`) to decimal feet (14.5).
- Convert everything to one internal unit so the calculator only sees one.
- Later: land units (ropani, aana, dhur, paisa).

### 5.4 Confirmation screen (app)

An editable table with category, label, length, breadth, and unit. The user can add, delete, or change rows.

### 5.5 Calculation (shared package)

Each category has a rate and a measuring type (`per`):

| per      | formula                 | example             |
| -------- | ----------------------- | ------------------- |
| `area`   | length x breadth x rate | tiles, plaster      |
| `length` | length x rate           | skirting            |
| `count`  | count x rate            | fixtures, per piece |

Worked example: 14.5 x 4.5 = 65.25 sq ft, then 65.25 x 15 = Rs 978.75.

```ts
import Decimal from "decimal.js";

export function lineAmount(item: Item, rate: Rate) {
  const qty =
    rate.per === "area"
      ? new Decimal(item.length).times(item.breadth)
      : rate.per === "length"
        ? new Decimal(item.length)
        : new Decimal(item.count ?? 1);
  return { qty, amount: qty.times(rate.value) };
}
```

### 5.6 Grouping and ordering

The output order is a fixed list in code, not the order in the photo:

```ts
export const CATEGORY_ORDER = [
  { key: "tiles_marble", label: "Tiles / Marble", labelNe: "टायल / मार्बल" },
  { key: "plaster", label: "Plaster", labelNe: "प्लास्टर" },
  { key: "koramasino", label: "Koramasino", labelNe: "कोरामसिनो" },
];
```

Categories not in the list go at the end under "Other" instead of being dropped.

### 5.7 Report export (app)

1. Build an HTML string with a section per category, its rows, a subtotal, and a grand total.
2. `Print.printToFileAsync({ html })` creates the PDF.
3. `Sharing.shareAsync(uri)` opens the share sheet.
4. For JPG, render the same layout in a view and capture it with `react-native-view-shot`.

Notes:

- Embed the Noto Sans Devanagari font in the HTML so Nepali labels render the same on every phone.
- Use `page-break-inside: avoid` on each category table.
- Format money in Nepali grouping: `n.toLocaleString("en-IN")` gives `1,23,456.50`.
- If on-device output turns out inconsistent, move PDF generation to the API with Puppeteer.

---

## 6. Data model

```
User
  id, name, phone, language

Project
  id, userId, title, clientName, createdAt

Rate                         (saved defaults per user)
  id, userId, categoryKey, value, per (area|length|count)

Estimate
  id, projectId, photoUrl, status (draft|confirmed), grandTotal, createdAt

EstimateItem
  id, estimateId, categoryKey, label, length, breadth, unit,
  qty, rateValue, rateType, amount

Export
  id, estimateId, type (pdf|jpg), fileUrl, createdAt
```

Rates are copied into `EstimateItem` when the estimate is confirmed, so changing a saved rate later doesn't change old estimates.

---

## 7. API endpoints

| Method | Path                     | Purpose                              |
| ------ | ------------------------ | ------------------------------------ |
| POST   | `/auth/otp/request`      | Send OTP                             |
| POST   | `/auth/otp/verify`       | Verify OTP, return JWT               |
| POST   | `/projects`              | Create a project                     |
| GET    | `/projects`              | List the user's projects             |
| POST   | `/estimates/extract`     | Upload photo, return extracted items |
| PATCH  | `/estimates/:id`         | Save the user's edits                |
| POST   | `/estimates/:id/confirm` | Lock items and rates                 |
| GET    | `/rates`                 | Get saved rates                      |
| PUT    | `/rates/:categoryKey`    | Update a saved rate                  |

---

## 8. Folder structure

```
construction-estimator/
  apps/
    mobile/                      # Expo app
      app/                       # Expo Router screens
        (auth)/login.tsx
        (tabs)/projects.tsx
        (tabs)/rates.tsx
        estimate/[id]/capture.tsx
        estimate/[id]/confirm.tsx
        estimate/[id]/result.tsx
      components/
        ItemsTable.tsx
        RateEditor.tsx
        ReportView.tsx
      lib/
        api.ts
        report-html.ts           # builds the HTML for PDF/JPG
        pdf.ts                   # expo-print + sharing
      store/
    api/                         # NestJS
      src/
        auth/
        projects/
        estimates/
        extraction/              # Claude vision call + JSON schema
        normalizer/              # numerals, units
        rates/
        storage/
        prisma/
  packages/
    shared/                      # types, CATEGORY_ORDER, calculation engine
```

A monorepo (pnpm workspaces or npm workspaces) keeps `shared` importable from both sides.

---

## 9. Edge cases

- Blurry or dark photos: show a retake message instead of guessing.
- Misread digits: the confirm screen is the safety net.
- Mixed units on one page (feet in one row, meters in another).
- Missing length or breadth: flag the row, don't calculate it.
- Unknown category: let the user pick one.
- The same room listed twice.
- Large images: compress on the device before upload.
- No network: save the draft locally and upload when back online.
- Extraction API fails or times out: let the user enter items manually.

---

## 10. Security and cost

- Keep the vision API key on the server only, never in the app.
- Rate-limit `/estimates/extract` per user, since each call costs money.
- Validate the model's JSON with zod before it reaches the calculator.
- Store photos in private buckets and serve them with signed URLs.
- Hash or avoid storing phone numbers beyond what login needs.

---

## 11. Build phases

**Phase 1 (MVP)**

- Expo app with capture, confirm screen, and result screen.
- NestJS API with auth and the extract endpoint.
- Three categories: tiles/marble, plaster, koramasino.
- Rates typed per job.
- PDF export and share, English with Nepali labels.

**Phase 2**

- Saved rates per user and JPG export.
- Feet-inches and land unit conversion.
- Project history and reopening old estimates.
- Offline drafts.

**Phase 3**

- More categories (brick, cement, rebar, paint) with real quantity formulas.
- Wastage percentage and other conditions (wall thickness, floors).
- Rates by district.
- Full Nepali UI.

---

## 12. Open questions

- What exactly is koramasino, and is its rate per sq ft, per running ft, or per piece?
- Should rates be typed per job, saved in settings, or both? (This draft assumes both.)
- Phone OTP or email login for the MVP? OTP needs an SMS provider that works in Nepal.
- Should the PDF show rates and quantities to the client, or only final amounts?
- Which vision model and what per-image cost is acceptable?
