import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDiaryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsArray()
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
  @IsObject()
  weatherSnapshot?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  timePhase?: string;

  /** YYYY-MM-DD */
  @IsString()
  @MaxLength(10)
  dateKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  clientMutationId?: string;
}
