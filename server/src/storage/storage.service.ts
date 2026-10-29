import { Injectable } from "@nestjs/common";

export interface StorageService {
  readonly enabled: boolean;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
}
export const STORAGE_SERVICE = Symbol("STORAGE_SERVICE");

/** Used when no bucket is configured: photos are simply not kept. */
@Injectable()
export class NullStorageService implements StorageService {
  readonly enabled = false;
  async put(): Promise<void> {
    return;
  }
}
