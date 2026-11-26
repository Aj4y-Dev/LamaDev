import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { createWorker, OEM, PSM, Worker, type Bbox, type Line } from 'tesseract.js';
import type { ItemReader } from './item-reader';
import type { RawItem } from './normalizer';
import { parseMeasurementLine } from './text-parser';

export interface TesseractOptions {
  languages: string[];
  debug: boolean;
  log: (message: string) => void;
}

interface Attempt {
  name: string;
  buffer: Buffer;
  psm: PSM;
}
interface Scored {
  items: RawItem[];
  unsure: number;
  confidence: number;
  /** Line/word boxes of the winning attempt, kept so weak digits can be re-read close up. Empty when the page had no layout data. */
  lines: Line[];
  buffer: Buffer;
}

/** A line whose numbers Tesseract is less sure of than this (0-100) is flagged for a person to double-check. */
export const UNSURE_BELOW = 80;
/** Stop trying other cleanups once a try finds lines, none unsure, and the page confidence is at least this. */
const GOOD_ENOUGH_CONFIDENCE = 80;
/** Characters a measurement number can contain. Restricting to these before re-reading a weak digit removes
 * the letter/digit confusion (e.g. "l" vs "1") that is the main source of handwritten-number misreads. */
const DIGIT_WHITELIST = `0123456789.'"×x*-`;

/**
 * Free, local OCR (Tesseract). No API key and no per-photo cost.
 * Works best on printed or neat block-letter writing. Cursive handwriting is not reliable.
 * Every line carries a confidence, so numbers the reader is unsure about can be shown to the user.
 */
export class TesseractReader implements ItemReader {
  private worker: Promise<Worker> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly opts: TesseractOptions) {}

  async read(image: Buffer): Promise<RawItem[]> {
    const { debug, log } = this.opts;
    if (debug) {
      const file = join(tmpdir(), 'ocr-input.jpg');
      writeFileSync(file, image);
      log(`Photo received (${Math.round(image.length / 1024)} KB). Saved to ${file} - open it to see what Tesseract sees`);
    }

    let best: Scored = { items: [], unsure: 0, confidence: 0, lines: [], buffer: image };
    for (const attempt of await this.attempts(image)) {
      const scored = await this.enqueue(() => this.recognize(attempt));
      if (debug) {
        log(`OCR try "${attempt.name}": ${scored.items.length} lines, ${scored.unsure} unsure, confidence ${Math.round(scored.confidence)}\n` +
          scored.items.map((i) => `  ${i.label} | ${i.length} x ${i.breadth ?? '-'} | conf ${Math.round(i.confidence ?? 0)}`).join('\n'));
      }
      if (this.isBetter(scored, best)) best = scored;
      if (scored.items.length > 0 && scored.unsure === 0 && scored.confidence >= GOOD_ENOUGH_CONFIDENCE) break;
    }
    if (best.unsure > 0 && best.lines.length > 0) {
      const refined = await this.enqueue(() => this.refineDigits(best));
      if (debug) log(`Digit re-check: ${best.unsure} unsure -> ${refined.filter((i) => i.uncertain).length} unsure`);
      return refined;
    }
    return best.items;
  }

  /** More lines first, then fewer unsure lines, then higher confidence. */
  private isBetter(a: Scored, b: Scored): boolean {
    if (a.items.length !== b.items.length) return a.items.length > b.items.length;
    if (a.unsure !== b.unsure) return a.unsure < b.unsure;
    return a.confidence > b.confidence;
  }

  private async recognize(attempt: Attempt): Promise<Scored> {
    const worker = await this.getWorker();
    await worker.setParameters({ tessedit_pageseg_mode: attempt.psm });
    const { data } = await worker.recognize(attempt.buffer, {}, { blocks: true, text: true });

    const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
    const items = lines.length > 0 ? this.itemsFromLines(lines) : this.itemsFromPlainText(data.text, data.confidence);
    return { items, unsure: items.filter((i) => i.uncertain).length, confidence: data.confidence, lines, buffer: attempt.buffer };
  }

  private itemsFromLines(lines: Line[]): RawItem[] {
    const items: RawItem[] = [];
    for (const line of lines) {
      const item = parseMeasurementLine(line.text);
      if (!item) continue;
      // Confidence of the weakest number on this line.
      const numbers = line.words.filter((w) => /\d/.test(w.text));
      const confidence = numbers.length ? Math.min(...numbers.map((w) => w.confidence)) : line.confidence;
      items.push({ ...item, confidence, uncertain: confidence < UNSURE_BELOW });
    }
    return items;
  }

  private itemsFromPlainText(text: string, pageConfidence: number): RawItem[] {
    const items: RawItem[] = [];
    for (const raw of text.split(/\r?\n/)) {
      const item = parseMeasurementLine(raw);
      if (item) items.push({ ...item, confidence: pageConfidence, uncertain: pageConfidence < UNSURE_BELOW });
    }
    return items;
  }

  /**
   * Re-reads just the weak numbers of the winning attempt, zoomed in and restricted to digits/punctuation.
   * Handwritten digits are the one thing we cannot afford to get wrong, and a tight crop plus a narrow
   * character set reads them far better than the full-page pass that first found the line.
   */
  private async refineDigits(scored: Scored): Promise<RawItem[]> {
    const worker = await this.getWorker();
    try {
      const newLines: Line[] = [];
      for (const line of scored.lines) {
        const words = [...line.words];
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          if (word.confidence >= UNSURE_BELOW || !/\d/.test(word.text)) continue;
          const crop = await this.cropForRescan(scored.buffer, word.bbox);
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD, tessedit_char_whitelist: DIGIT_WHITELIST });
          const { data } = await worker.recognize(crop, {}, { text: true });
          const text = data.text.trim();
          if (text && /\d/.test(text) && data.confidence > word.confidence) words[i] = { ...word, text, confidence: data.confidence };
        }
        newLines.push({ ...line, words, text: words.map((w) => w.text).join(' ') });
      }
      return this.itemsFromLines(newLines);
    } finally {
      // The whitelist must not leak into the next photo's full-page recognition, or labels stop reading.
      await worker.setParameters({ tessedit_char_whitelist: '' });
    }
  }

  /** Crops tightly around one word, padded generously (handwritten strokes overshoot their box) and enlarged 3x. */
  private async cropForRescan(image: Buffer, bbox: Bbox): Promise<Buffer> {
    const meta = await sharp(image).metadata();
    const maxW = meta.width ?? bbox.x1;
    const maxH = meta.height ?? bbox.y1;
    const w = Math.max(1, bbox.x1 - bbox.x0);
    const h = Math.max(1, bbox.y1 - bbox.y0);
    const padX = Math.round(w * 0.3) + 8;
    const padY = Math.round(h * 0.7) + 8;
    const left = Math.max(0, bbox.x0 - padX);
    const top = Math.max(0, bbox.y0 - padY);
    const width = Math.max(1, Math.min(maxW - left, w + padX * 2));
    const height = Math.max(1, Math.min(maxH - top, h + padY * 2));
    return sharp(image).extract({ left, top, width, height }).resize({ width: width * 3, kernel: 'lanczos3' }).sharpen({ sigma: 1.5 }).png().toBuffer();
  }

  async close(): Promise<void> {
    if (this.worker) await (await this.worker).terminate();
  }

  /** One photo at a time: a single Tesseract worker is not safe to share between parallel jobs. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Removes shadows and uneven light: every pixel is divided by the brightness of the paper around it.
   * Phone photos nearly always have a shadow, and without this step Tesseract can read nothing at all.
   */
  private async flattenLight(image: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(image).grayscale().raw().toBuffer({ resolveWithObject: true });
    const paper = await sharp(image)
      .grayscale()
      .resize({ width: Math.max(32, Math.round(info.width / 10)) })
      .blur(4)
      .resize({ width: info.width, height: info.height, fit: 'fill', kernel: 'cubic' })
      .raw()
      .toBuffer();
    const out = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) out[i] = Math.min(255, Math.round((data[i] * 255) / Math.max(paper[i], 1)));
    return sharp(out, { raw: { width: info.width, height: info.height, channels: 1 } }).normalize().png().toBuffer();
  }

  /**
   * Finds how far the page is tilted (-8 to +8 degrees). Straight text lines make the ink
   * rows sharply uneven, so the angle with the most uneven rows is the straightest one.
   */
  private async skewAngle(flat: Buffer): Promise<number> {
    const small = await sharp(flat).resize({ width: 640, fit: 'inside' }).threshold(150).negate().png().toBuffer();
    let bestAngle = 0;
    let bestScore = -1;
    for (let a = -8; a <= 8; a += 0.5) {
      const { data } = await sharp(small).rotate(a, { background: '#000000' }).raw().toBuffer({ resolveWithObject: true });
      const meta = await sharp(small).rotate(a, { background: '#000000' }).metadata();
      const width = meta.width ?? 1;
      const height = Math.floor(data.length / width);
      let prev = 0;
      let score = 0;
      for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let x = 0; x < width; x++) if (data[y * width + x] > 127) sum++;
        score += (sum - prev) * (sum - prev);
        prev = sum;
      }
      if (score > bestScore) {
        bestScore = score;
        bestAngle = a;
      }
    }
    return bestAngle;
  }

  private async attempts(image: Buffer): Promise<Attempt[]> {
    const flat = await this.flattenLight(image);
    const angle = await this.skewAngle(flat);
    const straight = Math.abs(angle) >= 0.5 ? await sharp(flat).rotate(angle, { background: '#ffffff' }).png().toBuffer() : flat;
    const meta = await sharp(straight).metadata();
    const bigger = await sharp(straight).resize({ width: Math.round((meta.width ?? 1000) * 2), kernel: 'lanczos3' }).sharpen({ sigma: 1.2 }).png().toBuffer();
    // A fixed cutoff over-blackens a shadowed photo and under-blackens a bright one; Otsu's method picks
    // the cutoff from this photo's own brightness spread, which handwriting's uneven pen pressure needs.
    const bwThreshold = await this.otsuThreshold(straight);
    const bw = await sharp(straight).threshold(bwThreshold).png().toBuffer();
    const bigBw = await sharp(bigger).threshold(bwThreshold).png().toBuffer();
    const plain = await sharp(image).grayscale().normalize().sharpen().png().toBuffer();
    return [
      { name: `straightened ${angle}deg / auto layout`, buffer: straight, psm: PSM.AUTO },
      { name: 'straightened / scattered text', buffer: straight, psm: PSM.SPARSE_TEXT },
      { name: 'straightened, enlarged and sharpened / auto layout', buffer: bigger, psm: PSM.AUTO },
      { name: 'straightened, black and white / scattered text', buffer: bw, psm: PSM.SPARSE_TEXT },
      { name: 'straightened, enlarged and black and white / scattered text', buffer: bigBw, psm: PSM.SPARSE_TEXT },
      { name: 'plain gray / auto layout', buffer: plain, psm: PSM.AUTO },
    ];
  }

  /** Otsu's method: the brightness cutoff that best splits this photo's pixels into ink vs. paper. */
  private async otsuThreshold(image: Buffer): Promise<number> {
    const { data } = await sharp(image).grayscale().raw().toBuffer({ resolveWithObject: true });
    const histogram = new Array<number>(256).fill(0);
    for (const px of data) histogram[px]++;
    const total = data.length;
    let sumAll = 0;
    for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

    let weightBelow = 0;
    let sumBelow = 0;
    let bestVariance = -1;
    let bestThreshold = 127;
    for (let t = 0; t < 256; t++) {
      weightBelow += histogram[t];
      sumBelow += t * histogram[t];
      const weightAbove = total - weightBelow;
      if (weightBelow === 0 || weightAbove === 0) continue;
      const meanBelow = sumBelow / weightBelow;
      const meanAbove = (sumAll - sumBelow) / weightAbove;
      const variance = weightBelow * weightAbove * (meanBelow - meanAbove) ** 2;
      if (variance > bestVariance) {
        bestVariance = variance;
        bestThreshold = t;
      }
    }
    return bestThreshold;
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
    const langs = this.opts.languages;
    const langPath = this.prepareLanguageData(langs);
    const worker = await createWorker(langs, OEM.LSTM_ONLY, { langPath, gzip: true, cacheMethod: 'none' });
    await worker.setParameters({ preserve_interword_spaces: '1' });
    this.opts.log(`Tesseract ready (${langs.join('+')})`);
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
        this.opts.log(`No bundled data for "${lang}"; Tesseract will download it instead`);
        return undefined;
      }
    }
    return dir;
  }
}
