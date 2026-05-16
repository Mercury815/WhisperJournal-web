import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class DebugEnvironmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  weatherType?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  humidity?: number;

  @IsOptional()
  @IsNumber()
  timeOffsetMs?: number;
}
