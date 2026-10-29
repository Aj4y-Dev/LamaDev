import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CalcItem, CalcResult, CalculationService } from '../calculation/calculation.service';
import { CalcMode, RateInput } from '../common/types';
import { ExtractionService } from '../extraction/extraction.service';
import { NormalizerService } from '../normalizer/normalizer.service';
import { ProjectsService } from '../projects/projects.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.service';
import { CalculateDto, ExtractDto, UpdateItemsDto } from './dto/estimates.dto';
import { EstimateItem } from './estimate-item.entity';
import { Estimate } from './estimate.entity';
import { compressImage } from './image.util';
import { parseRates, toCalcRates } from './rates.util';

const itemView = (i: EstimateItem) => ({
  id: i.id,
  categoryKey: i.categoryKey,
  label: i.label,
  length: i.length ?? '',
  breadth: i.breadth,
  count: i.count,
  unit: i.unit,
});

@Injectable()
export class EstimatesService {
  private readonly logger = new Logger(EstimatesService.name);

  constructor(
    @InjectRepository(Estimate) private readonly estimates: Repository<Estimate>,
    @InjectRepository(EstimateItem) private readonly items: Repository<EstimateItem>,
    private readonly dataSource: DataSource,
    private readonly projects: ProjectsService,
    private readonly extraction: ExtractionService,
    private readonly normalizer: NormalizerService,
    private readonly calculation: CalculationService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  // ---------- extract: upload -> compress -> read -> validate -> normalize -> save ----------
  async extract(userId: string, projectId: string, file: Express.Multer.File | undefined, dto: ExtractDto) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'The "image" file is required' });
    await this.projects.findOwnedOrFail(userId, projectId);

    const jpeg = await compressImage(file.buffer);
    const raw = await this.extraction.extractItems(jpeg);
    const drafts = raw.map((r) => this.normalizer.normalizeExtractedItem(r, dto.categoryKey));

    const saved = await this.dataSource.transaction(async (m) => {
      let estimate: Estimate;
      if (dto.estimateId) {
        estimate = await this.loadOwned(userId, dto.estimateId, m);
        this.assertDraft(estimate);
        if (estimate.projectId !== projectId) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Estimate belongs to another project' });
      } else {
        estimate = await m.save(m.create(Estimate, { projectId, status: 'draft', mode: 'decimal', rates: null }));
      }
      const start = await m.count(EstimateItem, { where: { estimateId: estimate.id } });
      const rows = drafts.map((d, i) => m.create(EstimateItem, { ...d, estimateId: estimate.id, sortIndex: start + i }));
      return { estimateId: estimate.id, rows: await m.save(rows) };
    });

    await this.keepPhoto(userId, saved.estimateId, jpeg, saved.rows);
    return { id: saved.estimateId, items: saved.rows.map(itemView) };
  }

  // ---------- read ----------
  async getOne(userId: string, id: string) {
    const e = await this.loadOwned(userId, id);
    const items = await this.items.find({ where: { estimateId: id }, order: { sortIndex: 'ASC' } });
    return {
      id: e.id,
      projectId: e.projectId,
      status: e.status,
      mode: e.mode,
      rates: e.rates,
      grandTotal: e.grandTotal?.toFixed(2) ?? null,
      items: items.map(itemView),
    };
  }

  // ---------- replace the item list (keeps ids so results can point back at items) ----------
  async replaceItems(userId: string, id: string, dto: UpdateItemsDto) {
    const estimate = await this.loadOwned(userId, id);
    this.assertDraft(estimate);

    const rows = await this.dataSource.transaction(async (m) => {
      const existing = await m.find(EstimateItem, { where: { estimateId: id } });
      const byId = new Map(existing.map((e) => [e.id, e]));
      const keep = new Set<string>();
      const out: EstimateItem[] = [];

      dto.items.forEach((it, index) => {
        const row = it.id && byId.has(it.id) ? (byId.get(it.id) as EstimateItem) : m.create(EstimateItem, { estimateId: id });
        if (row.id) keep.add(row.id);
        row.categoryKey = it.categoryKey;
        row.label = this.normalizer.normalizeLabel(it.label);
        row.length = this.normalizer.normalizeDimensionText(it.length);
        row.breadth = this.normalizer.normalizeDimensionText(it.breadth);
        row.count = it.count ?? null;
        row.unit = it.unit;
        row.sortIndex = index;
        row.qty = null;
        row.rateValue = null;
        row.rateType = null;
        row.amount = null;
        out.push(row);
      });

      const drop = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
      if (drop.length) await m.delete(EstimateItem, drop);
      return m.save(out);
    });

    return { id, items: rows.map(itemView) };
  }

  // ---------- calculate (does not lock the estimate) ----------
  async calculate(userId: string, id: string, dto: CalculateDto): Promise<CalcResult> {
    const estimate = await this.loadOwned(userId, id);
    this.assertDraft(estimate);
    const rates = parseRates(dto.rates);
    const mode: CalcMode = dto.mode ?? estimate.mode;
    await this.estimates.update(id, { rates, mode });
    return this.run(id, rates, mode);
  }

  // ---------- confirm: snapshot rates and amounts ----------
  async confirm(userId: string, id: string) {
    const estimate = await this.loadOwned(userId, id);
    this.assertDraft(estimate);
    if (!estimate.rates) {
      throw new UnprocessableEntityException({ code: 'NOT_CALCULATED', message: 'Calculate the estimate before saving it' });
    }
    const result = await this.run(id, estimate.rates, estimate.mode);

    await this.dataSource.transaction(async (m) => {
      for (const g of result.groups) {
        for (const line of g.items) {
          await m.update(EstimateItem, line.id, { qty: line.qty as never, rateValue: g.rate.value as never, rateType: g.rate.per, amount: line.amount as never });
        }
      }
      await m.update(Estimate, id, { status: 'confirmed', grandTotal: result.grandTotal as never });
    });

    return { id, status: 'confirmed', grandTotal: result.grandTotal };
  }

  // ---------- helpers ----------
  private async run(id: string, rates: Record<string, RateInput>, mode: CalcMode): Promise<CalcResult> {
    const rows = await this.items.find({ where: { estimateId: id }, order: { sortIndex: 'ASC' } });
    const calcItems: CalcItem[] = rows.map((r) => ({
      id: r.id, categoryKey: r.categoryKey, label: r.label, length: r.length, breadth: r.breadth, count: r.count, unit: r.unit,
    }));
    return this.calculation.calculate(calcItems, toCalcRates(rates), mode);
  }

  /** Other users' estimates look like they do not exist. */
  private async loadOwned(userId: string, id: string, manager?: EntityManager): Promise<Estimate> {
    const repo = manager ? manager.getRepository(Estimate) : this.estimates;
    const e = await repo.findOne({ where: { id }, relations: { project: true } });
    if (!e || e.project.userId !== userId) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Estimate not found' });
    return e;
  }

  private assertDraft(e: Estimate): void {
    if (e.status !== 'draft') throw new ConflictException({ code: 'ALREADY_CONFIRMED', message: 'This estimate is already saved' });
  }

  private async keepPhoto(userId: string, estimateId: string, jpeg: Buffer, rows: EstimateItem[]): Promise<void> {
    if (!this.storage.enabled) return;
    try {
      const key = `${userId}/${estimateId}/${randomUUID()}.jpg`;
      await this.storage.put(key, jpeg, 'image/jpeg');
      await this.items.update(rows.map((r) => r.id), { photoKey: key });
    } catch {
      this.logger.warn('Could not store the photo; continuing without it');
    }
  }
}
