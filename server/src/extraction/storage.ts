import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

/** Keeps photos on this server's disk (your VPS). Keys are built from ids we generate, never from user input. */
export class LocalPhotoStore {
  private readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  /** Returns the key (path relative to the upload folder). */
  async save(userId: string, estimateId: string, jpeg: Buffer): Promise<string> {
    const key = join(userId, estimateId, `${randomUUID()}.jpg`);
    const full = join(this.root, key);
    await mkdir(join(this.root, userId, estimateId), { recursive: true });
    await writeFile(full, jpeg);
    return key.split('\\').join('/');
  }
}
