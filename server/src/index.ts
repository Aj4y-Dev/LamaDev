import { createApp } from './app';
import { config } from './config';
import { migrate, pool } from './db';
import { ClaudeVisionReader } from './extraction/claude-vision-reader';
import { GeminiVisionReader } from './extraction/gemini-vision-reader';
import { MockReader } from './extraction/mock-reader';
import { LocalPhotoStore } from './extraction/storage';
import { TesseractReader } from './extraction/tesseract-reader';
import type { ItemReader } from './extraction/item-reader';
import { log } from './log';

function makeReader(): ItemReader & { close?: () => Promise<void> } {
  switch (config.EXTRACTION_MODE) {
    case 'mock':
      return new MockReader();
    case 'claude':
      // ANTHROPIC_API_KEY is guaranteed present here: config.ts refuses to start otherwise.
      return new ClaudeVisionReader({ apiKey: config.ANTHROPIC_API_KEY as string, model: config.ANTHROPIC_MODEL });
    case 'gemini':
      // GEMINI_API_KEY is guaranteed present here: config.ts refuses to start otherwise.
      return new GeminiVisionReader({ apiKey: config.GEMINI_API_KEY as string, model: config.GEMINI_MODEL });
    case 'tesseract':
      return new TesseractReader({ languages: config.TESSERACT_LANGS.split('+').map((l) => l.trim()).filter(Boolean), debug: config.OCR_DEBUG === 'true', log: log.info });
  }
}

async function main(): Promise<void> {
  await migrate();

  const reader = makeReader();
  const photos = new LocalPhotoStore(config.UPLOAD_DIR);

  const server = createApp({ reader, photos }).listen(config.PORT, '0.0.0.0', () => {
    log.info(`API ready on http://localhost:${config.PORT}/api/v1 (photos are read with ${config.EXTRACTION_MODE}, saved in ${config.UPLOAD_DIR})`);
  });

  const stop = async () => {
    log.info('Shutting down');
    server.close();
    await reader.close?.();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
