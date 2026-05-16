import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AnonymousDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}
