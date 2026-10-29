import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/** Long edge max 2000 px, JPEG quality 80. Rotates by EXIF so phone photos are upright. */
export async function compressImage(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'The file is not a valid image' });
  }
}
