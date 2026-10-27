import type { RequestOptions } from "./client";
import type {
  CalculateResponse,
  CreateProjectInput,
  EstimateItem,
  ExtractResponse,
  Project,
  Rate,
  RateOverride,
} from "./types";

const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

let projects: Project[] = [
  { id: "p1", title: "Sharma House", clientName: "Ram Sharma" },
];

// Every project starts from these sample rates, then keeps its own copy.
const baseRates: Rate[] = [
  {
    categoryKey: "tiles_marble",
    label: "Tiles / Marble",
    labelNe: "टाइल्स / मार्बल",
    value: "85",
    per: "area",
  },
  {
    categoryKey: "plaster",
    label: "Plaster",
    labelNe: "प्लास्टर",
    value: "45",
    per: "area",
  },
  {
    categoryKey: "koramasino",
    label: "Koramasino",
    labelNe: "कोरामसिनो",
    value: "30",
    per: "length",
  },
];

const ratesByProject: Record<string, Rate[]> = {};
const ratesFor = (projectId: string): Rate[] =>
  (ratesByProject[projectId] ??= baseRates.map((r) => ({ ...r })));

const extracted: EstimateItem[] = [
  {
    id: "i1",
    categoryKey: "unknown",
    label: "Section A",
    length: "12",
    breadth: "10",
    count: null,
    unit: "ft",
  },
  {
    id: "i2",
    categoryKey: "unknown",
    label: "Section B",
    length: "14",
    breadth: "9",
    count: null,
    unit: "ft",
  },
];
let extractCount = 0;

// Fixed demo numbers only. Real calculation always happens on the backend,
// so this result does not change when you edit rates in mock mode.
const sampleResult: CalculateResponse = {
  currency: "NPR",
  grandTotal: "11550.00",
  invalid: [],
  groups: [
    {
      categoryKey: "tiles_marble",
      label: "Tiles / Marble",
      labelNe: "टाइल्स / मार्बल",
      rate: { value: "85", per: "area" },
      items: [
        {
          id: "i1",
          label: "Section A",
          qty: "120",
          unit: "sq ft",
          amount: "10200.00",
        },
      ],
      subtotal: "10200.00",
    },
    {
      categoryKey: "koramasino",
      label: "Koramasino",
      labelNe: "कोरामसिनो",
      rate: { value: "30", per: "length" },
      items: [
        {
          id: "i2",
          label: "Section A",
          qty: "20",
          unit: "ft",
          amount: "600.00",
        },
        {
          id: "i3",
          label: "Section B",
          qty: "25",
          unit: "ft",
          amount: "750.00",
        },
      ],
      subtotal: "1350.00",
    },
  ],
};

export async function mockRequest<T>(
  path: string,
  opts: RequestOptions,
): Promise<T> {
  await delay();
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

  // Rates, kept per project
  const projectRates = path.match(/^\/projects\/([^/]+)\/rates$/);
  if (projectRates && method === "GET") return out(ratesFor(projectRates[1]));

  const projectRate = path.match(/^\/projects\/([^/]+)\/rates\/([^/]+)$/);
  if (projectRate && method === "PUT") {
    const b = opts.body as RateOverride;
    const list = ratesFor(projectRate[1]);
    const idx = list.findIndex((r) => r.categoryKey === projectRate[2]);
    if (idx === -1) return out({});
    list[idx] = { ...list[idx], value: b.value, per: b.per };
    return out(list[idx]);
  }

  // Estimates
  if (path.endsWith("/estimates/extract")) {
    extractCount += 1;
    const res: ExtractResponse = {
      id: "e1",
      items: extracted.map((i) => ({ ...i, id: `${i.id}-${extractCount}` })),
    };
    return out(res);
  }

  if (path.endsWith("/items") || path.endsWith("/confirm")) return out({});
  if (path.endsWith("/calculate")) return out(sampleResult);

  return out({});
}
