import { createApp } from './app';
import { config } from './config';
import { migrate, pool } from './db';
import { MockReader } from './extraction/mock-reader';
import { LocalPhotoStore } from './extraction/storage';
import { TesseractReader } from './extraction/tesseract-reader';
import type { ItemReader } from './extraction/item-reader';
import { log } from './log';

async function main(): Promise<void> {
  await migrate();

  const reader: ItemReader & { close?: () => Promise<void> } =
    config.EXTRACTION_MODE === 'mock'
      ? new MockReader()
      : new TesseractReader({ languages: config.TESSERACT_LANGS.split('+').map((l) => l.trim()).filter(Boolean), debug: config.OCR_DEBUG === 'true', log: log.info });
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
