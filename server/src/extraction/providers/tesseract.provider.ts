import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { createWorker, OEM, PSM, Worker } from 'tesseract.js';
import { parseMeasurementText } from '../parsers/measurement-text.parser';
import { ExtractionProvider } from './extraction-provider.interface';

/**
 * Free, local OCR (Tesseract). No API key and no per-photo cost.
 * Language data comes from the @tesseract.js-data/* npm packages, so no download is needed.
 * Works best on printed or neat block handwriting. Cursive handwriting is not reliable.
 */
@Injectable()
export class TesseractProvider implements ExtractionProvider, OnModuleDestroy {
  private readonly logger = new Logger(TesseractProvider.name);
  private worker: Promise<Worker> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  async extract(image: Buffer): Promise<string> {
    const prepared = await sharp(image).grayscale().normalize().sharpen().png().toBuffer();
    const text = await this.enqueue(async () => {
      const worker = await this.getWorker();
      const { data } = await worker.recognize(prepared);
      return data.text;
    });
    return JSON.stringify({ items: parseMeasurementText(text) });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) await (await this.worker).terminate();
  }

  /** One photo at a time: a single Tesseract worker is not safe to share between parallel jobs. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private getWorker(): Promise<Worker> {
    if (!this.worker) {
      this.worker = this.createOcrWorker().catch((err) => {
        this.worker = null; // allow a retry on the next photo
        throw err;
      });
    }
    return this.worker;
  }

  private async createOcrWorker(): Promise<Worker> {
    const langs = (this.config.get<string>('TESSERACT_LANGS') ?? 'eng+nep').split('+').map((l) => l.trim()).filter(Boolean);
    const langPath = this.prepareLanguageData(langs);
    const worker = await createWorker(langs, OEM.LSTM_ONLY, { langPath, gzip: true, cacheMethod: 'none' });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
    this.logger.log(`Tesseract ready (${langs.join('+')})`);
    return worker;
  }

  /** Copies the bundled traineddata files into one folder. Returns undefined to fall back to Tesseract's own download. */
  private prepareLanguageData(langs: string[]): string | undefined {
    const dir = join(tmpdir(), 'estimator-tessdata');
    mkdirSync(dir, { recursive: true });
    for (const lang of langs) {
      const dest = join(dir, `${lang}.traineddata.gz`);
      if (existsSync(dest)) continue;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pkg = require(`@tesseract.js-data/${lang}`) as { langPath: string };
        copyFileSync(join(pkg.langPath, `${lang}.traineddata.gz`), dest);
      } catch {
        this.logger.warn(`No bundled data for "${lang}"; Tesseract will download it instead`);
        return undefined;
      }
    }
    return dir;
  }
}
