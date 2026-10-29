import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserThrottlerGuard } from '../common/guards/user-throttler.guard';
import type { AuthUser } from '../common/types';
import { CalculateDto, ExtractDto, UpdateItemsDto } from './dto/estimates.dto';
import { EstimatesService } from './estimates.service';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

@Controller()
@UseGuards(JwtAuthGuard)
export class EstimatesController {
  constructor(private readonly estimates: EstimatesService) {}

  @Post('projects/:id/estimates/extract')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, cb) =>
        ALLOWED.includes(file.mimetype)
          ? cb(null, true)
          : cb(new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Only JPEG, PNG or WebP images are allowed' }), false),
    }),
  )
  extract(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ExtractDto,
  ) {
    return this.estimates.extract(user.id, projectId, file, dto);
  }

  @Get('estimates/:id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.getOne(user.id, id);
  }

  @Put('estimates/:id/items')
  replaceItems(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateItemsDto) {
    return this.estimates.replaceItems(user.id, id, dto);
  }

  @Post('estimates/:id/calculate')
  calculate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CalculateDto) {
    return this.estimates.calculate(user.id, id, dto);
  }

  @Post('estimates/:id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.confirm(user.id, id);
  }
}
