# Frontend Architecture (React Native + Expo + TypeScript)

This document is a build spec for the mobile app of a construction estimator. A coding agent should be able to follow it without asking questions. It pairs with `backend-architecture.md`, and the API contract there is the source of truth. Anything marked **ASSUMPTION** is a default I picked and can be changed. Anything marked **OPEN** is undecided, so build it behind a small abstraction and don't guess further.

---

## 1. Product context

Nepali contractors (thekadar) take or upload a photo of measurements, written in English and/or Nepali. The app sends the photo to the backend, shows the extracted items in an editable table, lets the user check the rate per work category, shows the grouped cost result in Rs, and exports it as a PDF or JPG to share (mostly through WhatsApp).

The app is only a client. It does **no cost math**. All calculation happens on the backend, and the app displays what it returns.

Typical user: knows construction well, not comfortable with math or technology, often outdoors on a site, on a mid-range Android phone with a slow connection. The UI should be simple, with large touch targets, high contrast, and as few steps as possible.

---

## 2. Stack

| Concern              | Choice                                                                     |
| -------------------- | -------------------------------------------------------------------------- |
| Framework            | React Native + Expo (managed workflow), TypeScript in strict mode          |
| Navigation           | Expo Router (file-based)                                                   |
| Server state         | TanStack Query                                                             |
| Client state         | Zustand                                                                    |
| Forms and validation | react-hook-form + zod                                                      |
| HTTP                 | `fetch` wrapped in one typed API client (no axios)                         |
| Secure storage       | `expo-secure-store` (JWT)                                                  |
| Local storage        | `@react-native-async-storage/async-storage` (draft, language, onboarding)  |
| Camera / gallery     | `expo-camera` or `expo-image-picker`                                       |
| Image compression    | `expo-image-manipulator`                                                   |
| PDF                  | `expo-print`                                                               |
| Share                | `expo-sharing`                                                             |
| JPG export           | `react-native-view-shot`                                                   |
| Files                | `expo-file-system`                                                         |
| i18n                 | `i18next` + `react-i18next` + `expo-localization`                          |
| Network status       | `@react-native-community/netinfo`                                          |
| Fonts                | `@expo-google-fonts/noto-sans-devanagari` (and a Latin font such as Inter) |
| Styling              | `StyleSheet` with a small theme (tokens), no UI kit                        |
| Tests                | Jest (`jest-expo`) + React Native Testing Library                          |

All of these work in Expo Go, so no custom dev build is needed for the MVP. **ASSUMPTION:** storage is AsyncStorage rather than MMKV for exactly that reason.

---

## 3. Folder structure

```
client/
  app/                              # Expo Router: routes only, thin
    _layout.tsx                     # providers, fonts, auth gate
    (auth)/
      login.tsx
      register.tsx
    (tabs)/
      _layout.tsx
      index.tsx                     # projects list
      rates.tsx                     # saved rates
      settings.tsx                  # language, logout
    project/
      new.tsx
      [id].tsx                      # project detail, list of estimates
    estimate/
      [id]/
        capture.tsx
        confirm.tsx
        result.tsx
  src/
    api/
      client.ts                     # fetch wrapper, auth header, envelope, errors
      types.ts                      # API request/response types
      auth.api.ts
      projects.api.ts
      estimates.api.ts
      rates.api.ts
    features/
      auth/
        useAuth.ts
        authStore.ts
      projects/
        useProjects.ts
        ProjectCard.tsx
      estimates/
        useExtract.ts
        useCalculate.ts
        draftStore.ts               # items being edited (Zustand)
        ItemsTable.tsx
        ItemRow.tsx
        CategoryPicker.tsx
        ResultGroup.tsx
      rates/
        useRates.ts
        RateEditor.tsx
      report/
        buildReportHtml.ts          # pure function: result -> HTML string
        exportPdf.ts
        exportJpg.ts
        ReportView.tsx              # view used for the JPG capture
    components/                     # shared UI: Button, TextField, Screen, Card, EmptyState, ErrorState, Banner
    theme/
      tokens.ts                     # colors, spacing, radii, font sizes
    i18n/
      index.ts
      en.json
      ne.json
    lib/
      money.ts                      # display formatting only
      digits.ts                     # Nepali <-> ASCII digit helpers
      image.ts                      # compress for upload
      errors.ts                     # error code -> message key
      constants.ts                  # CATEGORY_ORDER (labels only), limits
    hooks/
      useNetwork.ts
  assets/
    fonts/
  app.json
  .env.example
```

Rules for the folders:

- `app/` files stay thin: they read route params, call hooks from `features/`, and render components. No business logic in route files.
- `features/` holds everything for one area (hooks, components, store). A feature does not import another feature's internals, only its exported hooks and components.
- `components/` holds only generic, reusable UI with no feature knowledge.

---

## 4. Design patterns to use

### 4.1 Feature-based structure with container/presentational split

Screens (in `app/`) are containers: they fetch data through hooks and handle navigation. Components in `features/` and `components/` are presentational: they receive props and emit callbacks. This makes components testable without network or navigation.

### 4.2 Typed API layer

All HTTP goes through `src/api/client.ts`. Feature hooks call functions from `*.api.ts` files, never `fetch` directly. The client:

- adds `Authorization: Bearer <token>` from the auth store
- unwraps the `{ data }` envelope and converts `{ error: { code, message, details } }` into a thrown `ApiError` with `code`, `message`, `status`
- sets a timeout (30 s for extract, 15 s for everything else)
- on HTTP 401, clears the token and routes to login (one place, not per screen)
- reads the base URL from `EXPO_PUBLIC_API_URL`

### 4.3 TanStack Query for server state, Zustand for editing state

- Anything that lives on the server (projects, estimates, rates) is a query or mutation. Do not copy it into Zustand.
- Zustand holds only what the user is currently editing and the server doesn't have yet: the draft item list on the confirm screen, per-job rate overrides, and the auth token mirror.
- Query keys are defined in one place per feature (`['projects']`, `['estimate', id]`, `['rates']`) and invalidated after the matching mutations.

### 4.4 Draft store with persistence

`draftStore` keeps the in-progress items and rate overrides for one estimate, persisted to AsyncStorage (Zustand `persist`). If the app is killed or the connection drops during editing, the user doesn't lose their corrections. The draft is cleared after a successful confirm.

### 4.5 Adapter pattern for platform services

Wrap camera/gallery, sharing, and file export behind small functions in `lib/` or `features/report/` (for example `exportPdf(html)`, `pickImage()`), so screens never import Expo modules directly. This keeps screens testable (mock the wrapper) and makes swapping a library a one-file change.

### 4.6 Pure functions for formatting and report building

`buildReportHtml(result, options)`, `formatRs(value)`, and the digit helpers are pure and have unit tests. No hooks or side effects inside them.

### 4.7 Single source of truth for design tokens

Colors, spacing, font sizes, and radii come from `theme/tokens.ts`. No hard-coded colors or magic numbers in components.

### 4.8 Error boundaries and explicit UI states

Every data screen handles four states: loading, error (with retry), empty, and success. Use `EmptyState` and `ErrorState` components. Wrap the root layout in an error boundary that shows a friendly "Something went wrong, restart" screen.

---

## 5. Screens and navigation

| Route                             | Purpose                                        |
| --------------------------------- | ---------------------------------------------- |
| `(auth)/login`, `(auth)/register` | Email + password for the MVP                   |
| `(tabs)/index`                    | List of projects, button to create one         |
| `(tabs)/rates`                    | View and edit saved rates per category         |
| `(tabs)/settings`                 | Language (English / नेपाली), logout            |
| `project/new`                     | Title and client name                          |
| `project/[id]`                    | The project's estimates, button "New estimate" |
| `estimate/[id]/capture`           | Take a photo or pick one, preview, upload      |
| `estimate/[id]/confirm`           | Editable items table plus rate check           |
| `estimate/[id]/result`            | Grouped totals, grand total, export buttons    |

Navigation guard: the root layout checks the auth store. No token means redirect to `(auth)/login`; a token means redirect away from `(auth)`.

---

## 6. Main flow in detail

1. **Capture.** User takes a photo or picks from the gallery. Request permissions only when needed; if denied, show a message with a button that opens system settings. Show a preview with "Retake" and "Use this photo".
2. **Compress.** `expo-image-manipulator`: resize so the long edge is at most 2000 px, JPEG quality 0.8. Reject files over 8 MB after compression with a clear message.
3. **Extract.** `POST /projects/:projectId/estimates/extract` as multipart with the field name `image`. Show a progress state with a cancel button. On success, store the returned estimate id and items in `draftStore` and go to `confirm`.
4. **Confirm.** Editable table: category (picker), label, length, breadth, unit. User can add a row, delete a row, and change any value. Rows with category `unknown` or missing values show an inline warning. Below the table, a rate section lists each category present, with its rate pre-filled from `GET /rates` and editable for this job only (stored as overrides in `draftStore`, not saved to the account unless the user taps "Save as my default").
5. **Calculate.** On "Calculate": `PUT /estimates/:id/items` with the edited items, then `POST /estimates/:id/calculate` with the overrides. Show the result screen from the response.
6. **Result.** Show groups in the order returned by the server (the server controls ordering), each with its items and subtotal, then the grand total. Show any `invalid` lines at the top with a "Fix" button that goes back to `confirm` and highlights those rows.
7. **Confirm and export.** "Save estimate" calls `POST /estimates/:id/confirm`. Then "Share PDF" and "Save as image" are enabled. Export works from the data already on the device.

---

## 7. API contract the app depends on

Base: `${EXPO_PUBLIC_API_URL}/api/v1`. Responses are `{ "data": ... }` on success and `{ "error": { "code", "message", "details"? } }` on failure. Money and quantities arrive as **strings**.

Endpoints used: `POST /auth/register`, `POST /auth/login`, `GET /users/me`, `POST /projects`, `GET /projects`, `GET /projects/:id`, `POST /projects/:id/estimates/extract`, `GET /estimates/:id`, `PUT /estimates/:id/items`, `POST /estimates/:id/calculate`, `POST /estimates/:id/confirm`, `GET /rates`, `PUT /rates/:categoryKey`.

Types to define in `src/api/types.ts`:

```ts
export type Unit = "ft" | "m";
export type RateType = "area" | "length" | "count";

export interface EstimateItem {
  id?: string;
  categoryKey: string; // 'tiles_marble' | 'plaster' | 'koramasino' | 'unknown' | ...
  label: string;
  length: string; // decimal string
  breadth?: string | null;
  count?: number | null;
  unit: Unit;
}

export interface RateOverride {
  value: string;
  per: RateType;
}

export interface CalculateRequest {
  rates?: Record<string, RateOverride>; // keyed by categoryKey
}

export interface CalculateResponse {
  groups: {
    categoryKey: string;
    label: string;
    labelNe: string;
    rate: { value: string; per: RateType };
    items: {
      id: string;
      label: string;
      qty: string;
      unit: string;
      amount: string;
    }[];
    subtotal: string;
  }[];
  invalid: { id: string; reason: string }[];
  grandTotal: string;
  currency: "NPR";
}
```

**ASSUMPTION:** the request body for per-job rates is `{ "rates": { "<categoryKey>": { "value": "15", "per": "area" } } }`. The backend spec only says "optional per-job rate overrides", so check this against the implemented endpoint and change the type if it differs.

Error codes the app must handle specifically: `EXTRACTION_FAILED` (offer manual entry: open `confirm` with an empty list), `VALIDATION_ERROR` (show field messages from `details`), `UNAUTHORIZED` (log out), `RATE_LIMITED` (tell the user to try again later). Anything else shows a generic message from `errors.ts`.

---

## 8. Report export (PDF and JPG)

**PDF**

1. `buildReportHtml(result, { language, projectTitle, clientName, date })` returns a full HTML string.
2. `Print.printToFileAsync({ html })` creates the file.
3. `Sharing.shareAsync(uri, { mimeType: 'application/pdf' })` opens the share sheet.

**JPG**

1. Render `ReportView` (a React Native view with the same content) off-screen or in a modal.
2. `captureRef(ref, { format: 'jpg', quality: 0.9 })` from `react-native-view-shot`.
3. Share the resulting file with `expo-sharing`.

Report layout:

- Header: app name, project title, client name, date.
- One section per group, in server order: heading (English or Nepali label based on the current language), rate line (for example "Rs 85.00 per sq ft"), a table of rows (label, size or quantity, amount), then the subtotal.
- Grand total at the bottom, large and bold.
- A short footer: "Estimate only. Actual cost may vary."

Rules:

- Use `page-break-inside: avoid` on each group table so a section doesn't split across pages.
- Money format is `Rs 1,23,456.50`: use `Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })` for **display only**. The client never adds, multiplies, or compares money values.
- Nepali text: embed the Noto Sans Devanagari font in the HTML as a base64 `@font-face` (load the font file with `expo-asset` and read it with `expo-file-system`), so it renders the same on every phone. **OPEN:** verify on a real Android and iOS device that Devanagari renders correctly before relying on the system font.
- Name files like `estimate-<projectTitle>-<yyyy-mm-dd>.pdf`, with unsafe characters removed.
- **OPEN:** whether the shared report should show rates and quantities or only final amounts. Build it behind an option `showDetails: boolean`, default `true`.

---

## 9. Internationalization

- Two languages: English (`en`) and Nepali (`ne`). Default is the device language if it is one of them, otherwise English. The user can change it in Settings, and the choice is stored locally.
- All UI strings come from `en.json` and `ne.json`. No hard-coded user-facing text in components.
- Category labels come from the API (`label`, `labelNe`), with a local fallback map in `constants.ts`.
- Numbers: **ASSUMPTION** the UI shows ASCII digits (0-9) in both languages. **OPEN:** Devanagari digits in Nepali mode. Keep all number display going through `lib/money.ts` and a `formatNumber` helper so this can be switched in one place.
- Number input: users may type Nepali digits. `lib/digits.ts` converts them to ASCII digits as they type, so the app always sends ASCII digits to the API.
- Test with long Nepali strings. Buttons and table headers must not clip or overflow.

---

## 10. Offline and connectivity

- `useNetwork` exposes `isOnline` from NetInfo. When offline, show a banner on every screen.
- Offline, the user can still edit the draft items and rates (persisted). Buttons that need the server (Extract, Calculate, Save estimate) are disabled with a short explanation.
- No automatic upload queue in the MVP. When the connection returns, the user taps the button again.
- Exporting a PDF or JPG from an already-calculated result works offline.

---

## 11. Permissions, platform notes, and dev setup

- Camera and photo library permission strings must be set in `app.json` in both English and a clear sentence the user will understand.
- Android: handle the hardware back button on the capture and confirm screens (ask before discarding edits).
- Keyboard: wrap forms in a keyboard-avoiding scroll view so inputs aren't hidden. Numeric fields use the decimal-pad keyboard.
- API URL during development: Android emulator uses `http://10.0.2.2:3000`, a physical phone needs the computer's LAN IP (for example `http://192.168.1.10:3000`), and both devices must be on the same Wi-Fi. Set it through `EXPO_PUBLIC_API_URL` in `.env`.
- Use HTTPS for any non-local environment.

`.env.example`:

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

---

## 12. UI and UX guidelines

- Touch targets at least 48 px high. Primary actions are full-width buttons at the bottom of the screen.
- Base font size at least 16. Use a high-contrast palette that stays readable in sunlight.
- One main action per screen. Avoid nested menus.
- The confirm table is the most important screen: show clear column labels, use numeric keyboards, highlight rows with problems, and let the user add or delete rows quickly.
- Show the grand total prominently on the result screen.
- Use plain words. Example: "Check the numbers we read from your photo" instead of "Review extracted data".
- Provide a light theme only for the MVP. **ASSUMPTION:** dark mode later.

---

## 13. Security

- Store the JWT only in `expo-secure-store`, never in AsyncStorage or logs.
- Never put API keys in the app. The vision API key lives only on the server. Only `EXPO_PUBLIC_*` values are bundled, and they must not be secrets.
- Do not log image data, tokens, or full API responses.
- On logout, clear the token, the React Query cache, and the draft store.

---

## 14. Testing requirements

Unit tests (must pass before moving on):

- `digits.ts`: Nepali to ASCII conversion, mixed input, empty input.
- `money.ts`: `Rs 1,23,456.50` grouping, zero, very large values, string input.
- `buildReportHtml`: contains every group and item in order, includes the grand total, escapes HTML in labels, switches labels by language.
- `draftStore`: add, edit, delete rows, set rate overrides, clear after confirm.
- `api/client.ts`: unwraps `data`, maps error envelopes to `ApiError`, handles 401 and timeouts.

Component tests (React Native Testing Library):

- `ItemsTable`: editing a cell updates the draft, invalid rows show warnings.
- `ResultGroup`: renders rows, subtotal, and the correct labels.
- Auth gate: unauthenticated users are redirected to login.

Mock the camera, sharing, and API modules. Never call the real backend in tests.

---

## 15. Build order for the agent

Do these in order and keep each step running before starting the next.

1. Project setup: strict TypeScript, ESLint, path alias `@/` to `src/`, `.env.example`, theme tokens, fonts, root layout with providers (QueryClient, i18n).
2. i18n with `en.json` and `ne.json`, language setting stored locally.
3. API client, `types.ts`, `ApiError`, and the auth store with `expo-secure-store`.
4. Auth screens and the navigation guard.
5. Projects: list, create, detail.
6. Rates tab: list and edit saved rates.
7. Capture screen: permissions, preview, compress, upload, `useExtract`.
8. `draftStore` with persistence, then the confirm screen with `ItemsTable`, `CategoryPicker`, and the rate section.
9. Calculate flow and the result screen, including `invalid` rows.
10. Report: `buildReportHtml`, PDF export and share, then the JPG export.
11. Offline banner, disabled states, error boundary, back-button handling.
12. Unit and component tests, then a short README with setup steps and env vars.

---

## 16. Out of scope for the MVP

Phone OTP login, social login, dark mode, Devanagari numerals (unless the OPEN item is decided), automatic upload queue, push notifications, land-unit input, brick/cement/rebar quantity screens, tablet layouts, and any client-side cost calculation.

---

## 17. Definition of done

- The full flow works end to end on a real Android phone against the running backend: login, create project, capture, extract, edit, calculate, save, share PDF, save JPG.
- The app never performs money arithmetic.
- Nepali labels render correctly on screen and in the exported PDF and JPG.
- Losing connection during editing does not lose the draft.
- Logging out clears all user data from the device.
- Lint, type checks, and tests pass, with no `any` types in `api/`, `lib/`, and `features/report/`.
