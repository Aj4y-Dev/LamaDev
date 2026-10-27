import type { RequestOptions } from "./client";
import type {
  CalculateResponse,
  CreateProjectInput,
  EstimateItem,
  ExtractResponse,
  Project,
  RateOverride,
  ResultGroupData,
} from "./types";

const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

let projects: Project[] = [
  { id: "p1", title: "Sharma House", clientName: "Ram Sharma" },
];

let extractCount = 0;
let storedItems: EstimateItem[] = [];

// MOCK ONLY: stands in for the backend so the app can be tried without a server.
function computeSample(
  items: EstimateItem[],
  rates: Record<string, RateOverride>,
): CalculateResponse {
  const groups = new Map<string, ResultGroupData>();
  const invalid: { id: string; reason: string }[] = [];
  let total = 0;

  items.forEach((item, idx) => {
    const id = item.id ?? `item-${idx}`;
    const rate = rates[item.categoryKey];
    if (!rate || !(Number(rate.value) > 0)) {
      invalid.push({ id, reason: "NO_RATE" });
      return;
    }
    const len = Number(item.length);
    const br = Number(item.breadth ?? "");
    let qty: number;
    let unit: string;
    if (rate.per === "area") {
      if (!(len > 0)) {
        invalid.push({ id, reason: "MISSING_LENGTH" });
        return;
      }
      if (!(br > 0)) {
        invalid.push({ id, reason: "MISSING_BREADTH" });
        return;
      }
      qty = len * br;
      unit = "sq ft";
    } else if (rate.per === "length") {
      if (!(len > 0)) {
        invalid.push({ id, reason: "MISSING_LENGTH" });
        return;
      }
      qty = len;
      unit = "ft";
    } else {
      qty = item.count ?? 1;
      unit = "pcs";
    }
    const amount = qty * Number(rate.value);
    total += amount;

    let g = groups.get(item.categoryKey);
    if (!g) {
      const label = rate.label ?? item.categoryKey;
      g = {
        categoryKey: item.categoryKey,
        label,
        labelNe: label,
        rate: { value: rate.value, per: rate.per },
        items: [],
        subtotal: "0.00",
      };
      groups.set(item.categoryKey, g);
    }
    g.items.push({
      id,
      label: item.label,
      qty: qty.toFixed(3),
      unit,
      amount: amount.toFixed(2),
    });
    g.subtotal = (Number(g.subtotal) + amount).toFixed(2);
  });

  return {
    currency: "NPR",
    grandTotal: total.toFixed(2),
    invalid,
    groups: Array.from(groups.values()),
  };
}

export async function mockRequest<T>(
  path: string,
  opts: RequestOptions,
): Promise<T> {
  await delay(path.endsWith("/estimates/extract") ? 900 : 400);
  const method = opts.method ?? "GET";
  const out = (v: unknown) => v as T;

  // Auth
  if (path === "/auth/login" || path === "/auth/register") {
    return out({
      token: "mock-token",
      user: { id: "u1", email: "demo@example.com" },
    });
  }

  // Projects
  if (path === "/projects" && method === "GET") return out(projects);
  if (path === "/projects" && method === "POST") {
    const b = opts.body as CreateProjectInput;
    const p: Project = {
      id: `p${Date.now()}`,
      title: b.title,
      clientName: b.clientName ?? null,
    };
    projects = [p, ...projects];
    return out(p);
  }
  const one = path.match(/^\/projects\/([^/]+)$/);
  if (one && method === "GET") {
    return out(projects.find((p) => p.id === one[1]) ?? projects[0]);
  }

  // Estimates
  if (path.endsWith("/estimates/extract")) {
    extractCount += 1;
    const n = extractCount;
    const res: ExtractResponse = {
      id: "e1",
      items: [
        {
          id: `i${n}a`,
          categoryKey: "unknown",
          label: `Section ${n}A`,
          length: String(10 + n),
          breadth: "8",
          count: null,
          unit: "ft",
        },
        {
          id: `i${n}b`,
          categoryKey: "unknown",
          label: `Section ${n}B`,
          length: String(14 + n),
          breadth: "9",
          count: null,
          unit: "ft",
        },
      ],
    };
    return out(res);
  }
  if (path.endsWith("/items")) {
    storedItems = (opts.body as { items: EstimateItem[] }).items;
    return out({});
  }
  if (path.endsWith("/calculate")) {
    const body = (opts.body ?? {}) as { rates?: Record<string, RateOverride> };
    return out(computeSample(storedItems, body.rates ?? {}));
  }
  if (path.endsWith("/confirm")) return out({});

  return out({});
}
