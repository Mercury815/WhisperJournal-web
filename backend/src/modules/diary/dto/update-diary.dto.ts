import { IsInt, IsOptional, IsString, MaxLength, MinLength, Min } from 'class-validator';

export class UpdateDiaryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  primaryEmotion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  weatherType?: string;

  @IsOptional()
  weatherSnapshot?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  timePhase?: string;

  /** 乐观锁：与服务端 version 一致方可更新 */
  @IsInt()
  @Min(1)
  version!: number;
}
