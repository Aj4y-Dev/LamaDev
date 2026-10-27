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
let rates: Rate[] = [
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

const extracted: EstimateItem[] = [
  {
    id: "i1",
    categoryKey: "tiles_marble",
    label: "Living room floor",
    length: "12",
    breadth: "10",
    count: null,
    unit: "ft",
  },
  {
    id: "i2",
    categoryKey: "plaster",
    label: "Bedroom wall",
    length: "14",
    breadth: "9",
    count: null,
    unit: "ft",
  },
  {
    id: "i3",
    categoryKey: "unknown",
    label: "Passage",
    length: "20",
    breadth: "",
    count: null,
    unit: "ft",
  },
];

// Fixed demo numbers only. Real calculation always happens on the backend.
const sampleResult: CalculateResponse = {
  currency: "NPR",
  grandTotal: "17610.00",
  invalid: [{ id: "i3", reason: "Category is unknown" }],
  groups: [
    {
      categoryKey: "tiles_marble",
      label: "Tiles / Marble",
      labelNe: "टाइल्स / मार्बल",
      rate: { value: "85", per: "area" },
      items: [
        {
          id: "i1",
          label: "Living room floor",
          qty: "120",
          unit: "sq ft",
          amount: "10200.00",
        },
      ],
      subtotal: "10200.00",
    },
    {
      categoryKey: "plaster",
      label: "Plaster",
      labelNe: "प्लास्टर",
      rate: { value: "45", per: "area" },
      items: [
        {
          id: "i2",
          label: "Bedroom wall",
          qty: "126",
          unit: "sq ft",
          amount: "5670.00",
        },
      ],
      subtotal: "5670.00",
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

  if (path === "/auth/login" || path === "/auth/register") {
    return out({
      token: "mock-token",
      user: { id: "u1", email: "demo@example.com" },
    });
  }

  const one = path.match(/^\/projects\/([^/]+)$/);
  if (one && method === "GET")
    return out(projects.find((p) => p.id === one[1]) ?? projects[0]);

  if (path.endsWith("/estimates/extract")) {
    const res: ExtractResponse = { id: "e1", items: extracted };
    return out(res);
  }
  if (path.endsWith("/items") || path.endsWith("/confirm")) return out({});
  if (path.endsWith("/calculate")) return out(sampleResult);

  if (path === "/rates" && method === "GET") return out(rates);
  const rate = path.match(/^\/rates\/([^/]+)$/);
  if (rate && method === "PUT") {
    const b = opts.body as RateOverride;
    rates = rates.map((r) =>
      r.categoryKey === rate[1] ? { ...r, value: b.value } : r,
    );
    return out(rates.find((r) => r.categoryKey === rate[1]));
  }
  return out({});
}
