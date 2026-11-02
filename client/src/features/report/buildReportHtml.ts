import type { CalculateResponse } from "@/api/types";
import { formatNumber, formatRs } from "@/lib/money";

export interface ReportOptions {
  language: "en" | "ne";
  projectTitle: string;
  clientName?: string | null;
  date: string;
  showDetails?: boolean;
  fontBase64?: string; // optional: Noto Sans Devanagari embedded as base64
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PER: Record<"en" | "ne", Record<string, string>> = {
  en: { area: "per sq ft", length: "per ft", count: "per piece" },
  ne: { area: "प्रति वर्ग फिट", length: "प्रति फिट", count: "प्रति गोटा" },
};
const UNIT: Record<"en" | "ne", Record<string, string>> = {
  en: { sqft: "sq ft", ft: "ft", pcs: "pcs" },
  ne: { sqft: "वर्ग फिट", ft: "फिट", pcs: "गोटा" },
};
const T = {
  en: {
    line: "Line",
    result: "Result",
    totalArea: "Total",
    rate: "Rate",
    amount: "Amount",
    total: "Grand total",
    foot: "Estimate only. Actual cost may vary.",
    client: "Client",
    check: "* please double-check",
  },
  ne: {
    line: "लाइन",
    result: "नतिजा",
    totalArea: "जम्मा",
    rate: "दर",
    amount: "रकम",
    total: "कुल जम्मा",
    foot: "अनुमान मात्र हो। वास्तविक लागत फरक पर्न सक्छ।",
    client: "ग्राहक",
    check: "* कृपया फेरि जाँच्नुहोस्",
  },
};

/** Pure: result -> HTML. Groups and lines stay in the order the server gave them. */
export function buildReportHtml(
  result: CalculateResponse,
  o: ReportOptions,
): string {
  const t = T[o.language];
  const showDetails = o.showDetails ?? true;
  const font = o.fontBase64
    ? `@font-face{font-family:'NotoDeva';src:url(data:font/ttf;base64,${o.fontBase64}) format('truetype');}`
    : "";
  let anyCheck = false;

  const groups = result.groups
    .map((g) => {
      const label = o.language === "ne" && g.labelNe ? g.labelNe : g.label;
      const unit = UNIT[o.language][g.unit ?? ""] ?? g.unit ?? "";
      const rows = g.items
        .map((i, n) => {
          if (i.check) anyCheck = true;
          const name = i.size || i.label || `${t.line} ${n + 1}`;
          return `<tr><td>${escapeHtml(name)}${i.check ? " *" : ""}</td><td class="r">${escapeHtml(formatNumber(i.qty))}</td></tr>`;
        })
        .join("");
      const total = g.totalQty
        ? `<tr class="sum"><td>${t.totalArea}</td><td class="r"><b>${escapeHtml(formatNumber(g.totalQty))} ${escapeHtml(unit)}</b></td></tr>`
        : "";
      const rate = showDetails
        ? `<tr><td>${t.rate}</td><td class="r">${escapeHtml(formatRs(g.rate.value))} ${escapeHtml(PER[o.language][g.rate.per] ?? g.rate.per)}</td></tr>`
        : "";
      return `<section class="group"><h2>${escapeHtml(label)}</h2>
<table><thead><tr><th>${t.line}</th><th class="r">${t.result} (${escapeHtml(unit)})</th></tr></thead><tbody>${rows}${total}${rate}
<tr class="amount"><td>${t.amount}</td><td class="r"><b>${escapeHtml(formatRs(g.subtotal))}</b></td></tr></tbody></table></section>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><style>${font}
body{font-family:'NotoDeva',-apple-system,Roboto,sans-serif;color:#0F172A;padding:24px;font-size:14px}
h1{font-size:22px;margin:0}.meta{color:#475569;margin:4px 0 20px}
.group{page-break-inside:avoid;margin-bottom:20px}h2{font-size:17px;margin:0 0 8px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 4px;border-bottom:1px solid #E2E8F0}.r{text-align:right}
.sum td{border-top:2px solid #0F172A}.amount td{font-size:16px}
.total{font-size:26px;font-weight:700;text-align:right;margin-top:16px}
.foot{color:#475569;font-size:12px;margin-top:24px}</style></head><body>
<h1>${escapeHtml(o.projectTitle)}</h1>
<p class="meta">${o.clientName ? `${t.client}: ${escapeHtml(o.clientName)} · ` : ""}${escapeHtml(o.date)}</p>
${groups}
<p class="total">${t.total}: ${escapeHtml(formatRs(result.grandTotal))}</p>
${anyCheck ? `<p class="foot">${t.check}</p>` : ""}
<p class="foot">${t.foot}</p></body></html>`;
}
