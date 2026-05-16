import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecognizeDto {
  @IsString()
  @MaxLength(4000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}
