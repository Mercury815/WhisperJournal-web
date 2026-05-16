import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SyncDiaryItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  clientMutationId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  emotions?: unknown[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  primaryEmotion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  weatherType?: string;

  @IsOptional()
  weatherSnapshot?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  timePhase?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}

export class SyncDiaryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  deviceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SyncDiaryItemDto)
  items!: SyncDiaryItemDto[];
}
