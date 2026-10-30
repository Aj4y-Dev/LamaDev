import type { PoolClient } from 'pg';
import { calculate, CalcItem, CalcRate, CalcResult } from '../calc/calculation';
import { Db, one, pool, rows, tx } from '../db';
import { readItems } from '../extraction/extraction.service';
import { compressImage } from '../extraction/image';
import type { ItemReader } from '../extraction/item-reader';
import { normalizeDimensionText, normalizeExtractedItem, normalizeLabel } from '../extraction/normalizer';
import type { LocalPhotoStore } from '../extraction/storage';
import { D } from '../lib/decimal';
import { badRequest, conflict, notFound, unprocessable } from '../lib/errors';
import { CalcMode, RateInput, Unit } from '../lib/types';
import { log } from '../log';
import { assertProjectOwned } from '../projects/projects.routes';

interface EstimateRow {
  id: string;
  project_id: string;
  status: 'draft' | 'confirmed';
  mode: CalcMode;
  rates: Record<string, RateInput> | null;
  grand_total: string | null;
}
interface ItemRow {
  id: string;
  estimate_id: string;
  category_key: string;
  label: string;
  length: string | null;
  breadth: string | null;
  count: number | null;
  unit: Unit;
  uncertain: boolean;
  sort_index: number;
}

const itemView = (i: ItemRow) => ({
  id: i.id, categoryKey: i.category_key, label: i.label, length: i.length ?? '', breadth: i.breadth, count: i.count, unit: i.unit, uncertain: i.uncertain,
});

export interface Deps {
  reader: ItemReader;
  photos: LocalPhotoStore;
}

/** Other users' estimates look like they do not exist. Pass lock=true inside a transaction to serialise edits. */
async function loadOwned(db: Db, userId: string, id: string, lock = false): Promise<EstimateRow> {
  const e = await one<EstimateRow>(
    db,
    `select e.* from estimates e join projects p on p.id = e.project_id where e.id = $1 and p.user_id = $2 ${lock ? 'for update of e' : ''}`,
    [id, userId],
  );
  if (!e) throw notFound('Estimate not found');
  return e;
}

function assertDraft(e: EstimateRow): void {
  if (e.status !== 'draft') throw conflict('ALREADY_CONFIRMED', 'This estimate is already saved');
}

const toCalcRates = (stored: Record<string, RateInput>): Record<string, CalcRate> =>
  Object.fromEntries(Object.entries(stored).map(([k, r]) => [k, { value: new D(r.value), per: r.per, label: r.label ?? k }]));

async function run(db: Db, id: string, rates: Record<string, RateInput>, mode: CalcMode): Promise<CalcResult> {
  const items = await rows<ItemRow>(db, 'select * from estimate_items where estimate_id = $1 order by sort_index', [id]);
  const calcItems: CalcItem[] = items.map((r) => ({
    id: r.id, categoryKey: r.category_key, label: r.label, length: r.length, breadth: r.breadth, count: r.count, unit: r.unit, uncertain: r.uncertain,
  }));
  return calculate(calcItems, toCalcRates(rates), mode);
}

// ---------- extract: upload -> compress -> read -> normalize -> save ----------
export async function extractFromPhoto(
  deps: Deps, userId: string, projectId: string, file: Express.Multer.File | undefined,
  fields: { categoryKey: string; estimateId?: string },
) {
  if (!file) throw badRequest('The "image" file is required');
  await assertProjectOwned(userId, projectId);

  const jpeg = await compressImage(file.buffer);
  const raw = await readItems(deps.reader, jpeg, log.warn);
  const drafts = raw.map((r) => normalizeExtractedItem(r, fields.categoryKey));

  const saved = await tx(async (c: PoolClient) => {
    let estimateId: string;
    if (fields.estimateId) {
      const e = await loadOwned(c, userId, fields.estimateId, true);
      assertDraft(e);
      if (e.project_id !== projectId) throw badRequest('This estimate belongs to another project');
      estimateId = e.id;
    } else {
      const created = await one<{ id: string }>(c, 'insert into estimates (project_id) values ($1) returning id', [projectId]);
      estimateId = (created as { id: string }).id;
    }
    const start = (await one<{ n: number }>(c, 'select count(*)::int as n from estimate_items where estimate_id = $1', [estimateId]))?.n ?? 0;
    const out: ItemRow[] = [];
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const r = await one<ItemRow>(
        c,
        `insert into estimate_items (estimate_id, category_key, label, length, breadth, count, unit, uncertain, sort_index)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [estimateId, d.categoryKey, d.label, d.length, d.breadth, d.count, d.unit, d.uncertain, start + i],
      );
      out.push(r as ItemRow);
    }
    return { estimateId, items: out };
  });

  // Keep the photo on this server's disk. A storage failure must not lose the estimate.
  try {
    const key = await deps.photos.save(userId, saved.estimateId, jpeg);
    await pool.query('update estimate_items set photo_key = $1 where id = any($2::uuid[])', [key, saved.items.map((i) => i.id)]);
  } catch (err) {
    log.warn(`could not store the photo: ${err instanceof Error ? err.message : 'error'}`);
  }
  return { id: saved.estimateId, items: saved.items.map(itemView) };
}

// ---------- read ----------
export async function getEstimate(userId: string, id: string) {
  const e = await loadOwned(pool, userId, id);
  const items = await rows<ItemRow>(pool, 'select * from estimate_items where estimate_id = $1 order by sort_index', [id]);
  return { id: e.id, projectId: e.project_id, status: e.status, mode: e.mode, rates: e.rates, grandTotal: e.grand_total, items: items.map(itemView) };
}

// ---------- replace the item list (keeps ids so results can point back at items) ----------
export interface ItemInput {
  id?: string;
  categoryKey: string;
  label: string;
  length?: string | null;
  breadth?: string | null;
  count?: number | null;
  unit: Unit;
}

export async function replaceItems(userId: string, id: string, items: ItemInput[]) {
  const saved = await tx(async (c) => {
    const e = await loadOwned(c, userId, id, true);
    assertDraft(e);
    const existing = new Set((await rows<{ id: string }>(c, 'select id from estimate_items where estimate_id = $1', [id])).map((r) => r.id));
    const keep: string[] = [];
    const out: ItemRow[] = [];

    for (let index = 0; index < items.length; index++) {
      const it = items[index];
      const values = [it.categoryKey, normalizeLabel(it.label), normalizeDimensionText(it.length), normalizeDimensionText(it.breadth), it.count ?? null, it.unit, index];
      if (it.id && existing.has(it.id)) {
        keep.push(it.id);
        out.push((await one<ItemRow>(
          c,
          // The server keeps its own "unsure" flag. It is cleared only if a person changed the numbers.
          `update estimate_items set category_key=$1, label=$2,
             uncertain = case when length is distinct from $3 or breadth is distinct from $4 then false else uncertain end,
             length=$3, breadth=$4, count=$5, unit=$6, sort_index=$7,
             qty=null, rate_value=null, rate_type=null, amount=null where id=$8 and estimate_id=$9 returning *`,
          [...values, it.id, id],
        )) as ItemRow);
      } else {
        const r = (await one<ItemRow>(
          c,
          `insert into estimate_items (category_key, label, length, breadth, count, unit, sort_index, estimate_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
          [...values, id],
        )) as ItemRow;
        keep.push(r.id);
        out.push(r);
      }
    }
    await c.query('delete from estimate_items where estimate_id = $1 and not (id = any($2::uuid[]))', [id, keep]);
    return out;
  });
  return { id, items: saved.map(itemView) };
}

// ---------- calculate (does not lock the estimate) ----------
export async function calculateEstimate(userId: string, id: string, body: { mode?: CalcMode; rates: Record<string, RateInput> }): Promise<CalcResult> {
  const e = await loadOwned(pool, userId, id);
  assertDraft(e);
  const rates: Record<string, RateInput> = {};
  for (const [k, r] of Object.entries(body.rates)) {
    const label = (r.label ?? '').replace(/\s+/g, ' ').trim();
    rates[k] = { value: r.value, per: r.per, ...(label ? { label } : {}) };
  }
  const mode = body.mode ?? e.mode;
  await pool.query('update estimates set rates = $1, mode = $2, updated_at = now() where id = $3', [JSON.stringify(rates), mode, id]);
  return run(pool, id, rates, mode);
}

// ---------- confirm: snapshot rates and amounts ----------
export async function confirmEstimate(userId: string, id: string) {
  return tx(async (c) => {
    const e = await loadOwned(c, userId, id, true);
    assertDraft(e);
    if (!e.rates) throw unprocessable('NOT_CALCULATED', 'Calculate the estimate before saving it');
    const result = await run(c, id, e.rates, e.mode);
    for (const g of result.groups) {
      for (const line of g.items) {
        await c.query('update estimate_items set qty = $1, rate_value = $2, rate_type = $3, amount = $4 where id = $5', [line.qty, e.rates[g.categoryKey].value, g.rate.per, line.amount, line.id]);
      }
    }
    await c.query(`update estimates set status = 'confirmed', grand_total = $1, updated_at = now() where id = $2`, [result.grandTotal, id]);
    return { id, status: 'confirmed', grandTotal: result.grandTotal };
  });
}
