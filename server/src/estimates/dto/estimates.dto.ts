import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CALC_MODES, CalcMode, UNITS, Unit } from '../../common/types';

export class ExtractDto {
  @IsString() @Matches(/^[a-z0-9_]{1,64}$/) categoryKey: string;
  @IsOptional() @IsUUID() estimateId?: string;
}

export class ItemDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @Matches(/^[a-z0-9_]{1,64}$/) categoryKey: string;
  @IsString() @MaxLength(200) label: string;
  @IsOptional() @IsString() @MaxLength(32) length?: string | null;
  @IsOptional() @IsString() @MaxLength(32) breadth?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) count?: number | null;
  @IsIn(UNITS) unit: Unit;
}

export class UpdateItemsDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ItemDto) items: ItemDto[];
}

export class CalculateDto {
  @IsOptional() @IsIn(CALC_MODES) mode?: CalcMode;
  @IsObject() rates: Record<string, unknown>;
}
