import type { CalculateResponse } from '@/api/types';
import { formatNumber, formatRs } from '@/lib/money';

export interface ReportOptions {
  language: 'en' | 'ne';
  projectTitle: string;
  clientName?: string | null;
  date: string;
  showDetails?: boolean;
  fontBase64?: string; // OPEN: Noto Sans Devanagari embed, see spec section 8
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const PER: Record<'en' | 'ne', Record<string, string>> = {
  en: { area: 'per sq ft', length: 'per ft', count: 'per piece' },
  ne: { area: 'प्रति वर्ग फिट', length: 'प्रति फिट', count: 'प्रति गोटा' },
};
const T = {
  en: { item: 'Item', qty: 'Quantity', amount: 'Amount', subtotal: 'Subtotal', total: 'Grand total', foot: 'Estimate only. Actual cost may vary.', client: 'Client' },
  ne: { item: 'विवरण', qty: 'परिमाण', amount: 'रकम', subtotal: 'उप-जम्मा', total: 'कुल जम्मा', foot: 'अनुमान मात्र हो। वास्तविक लागत फरक पर्न सक्छ।', client: 'ग्राहक' },
};

/** Pure: result -> HTML. Groups and items stay in server order. */
export function buildReportHtml(result: CalculateResponse, o: ReportOptions): string {
  const t = T[o.language];
  const showDetails = o.showDetails ?? true;
  const font = o.fontBase64
    ? `@font-face{font-family:'NotoDeva';src:url(data:font/ttf;base64,${o.fontBase64}) format('truetype');}`
    : '';
  const groups = result.groups.map((g) => {
    const label = o.language === 'ne' && g.labelNe ? g.labelNe : g.label;
    const rateLine = showDetails
      ? `<p class="rate">${escapeHtml(formatRs(g.rate.value))} ${escapeHtml(PER[o.language][g.rate.per] ?? g.rate.per)}</p>`
      : '';
    const rows = g.items.map((i) =>
      `<tr><td>${escapeHtml(i.label)}</td>${showDetails ? `<td>${escapeHtml(formatNumber(i.qty))} ${escapeHtml(i.unit)}</td>` : ''}<td class="r">${escapeHtml(formatRs(i.amount))}</td></tr>`).join('');
    return `<section class="group"><h2>${escapeHtml(label)}</h2>${rateLine}
<table><thead><tr><th>${t.item}</th>${showDetails ? `<th>${t.qty}</th>` : ''}<th class="r">${t.amount}</th></tr></thead><tbody>${rows}</tbody></table>
<p class="sub">${t.subtotal}: <b>${escapeHtml(formatRs(g.subtotal))}</b></p></section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>${font}
body{font-family:'NotoDeva',-apple-system,Roboto,sans-serif;color:#0F172A;padding:24px;font-size:14px}
h1{font-size:22px;margin:0}.meta{color:#475569;margin:4px 0 20px}
.group{page-break-inside:avoid;margin-bottom:20px}h2{font-size:17px;margin:0 0 4px}.rate{color:#475569;margin:0 0 8px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 4px;border-bottom:1px solid #E2E8F0}.r{text-align:right}
.sub{text-align:right;margin:6px 0 0}.total{font-size:26px;font-weight:700;text-align:right;margin-top:16px}
.foot{color:#475569;font-size:12px;margin-top:24px}</style></head><body>
<h1>${escapeHtml(o.projectTitle)}</h1>
<p class="meta">${o.clientName ? `${t.client}: ${escapeHtml(o.clientName)} · ` : ''}${escapeHtml(o.date)}</p>
${groups}
<p class="total">${t.total}: ${escapeHtml(formatRs(result.grandTotal))}</p>
<p class="foot">${t.foot}</p></body></html>`;
}
