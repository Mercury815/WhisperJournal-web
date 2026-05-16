import { IsNotEmpty, Matches } from 'class-validator';

export class StatsMonthQueryDto {
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;
}
