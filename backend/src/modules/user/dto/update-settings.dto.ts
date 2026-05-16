import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  defaultAudioType?: string;

  @IsOptional()
  @IsBoolean()
  autoLoginEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  minimalModePreference?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  themePreference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  lastWeatherPermission?: string;

  @IsOptional()
  @IsObject()
  weatherLocation?: { label: string; lat: number; lon: number };
}
