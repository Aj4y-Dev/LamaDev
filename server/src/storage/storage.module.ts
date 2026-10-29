import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NullStorageService, STORAGE_SERVICE } from "./storage.service";

@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => {
        const endpoint = c.get<string>("STORAGE_ENDPOINT");
        const bucket = c.get<string>("STORAGE_BUCKET");
        const key = c.get<string>("STORAGE_ACCESS_KEY");
        const secret = c.get<string>("STORAGE_SECRET_KEY");
        return new NullStorageService();
      },
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
