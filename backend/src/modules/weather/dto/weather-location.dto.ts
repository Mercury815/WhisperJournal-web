import { IsNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class WeatherLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  label!: string;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lon!: number;
}
