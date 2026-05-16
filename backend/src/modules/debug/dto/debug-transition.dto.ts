import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DebugTransitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  trigger?: string;
}
