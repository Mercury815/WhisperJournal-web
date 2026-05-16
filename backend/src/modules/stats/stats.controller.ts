import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { resolveDiaryScope, type JwtSession } from '../../common/utils/session.util';
import { StatsMonthQueryDto } from './dto/stats-month.query';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(AuthGuard('jwt'))
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('calendar')
  calendar(@Req() req: Request & { user: JwtSession }, @Query() q: StatsMonthQueryDto) {
    return this.stats.calendar(resolveDiaryScope(req), q.month);
  }

  @Get('month-overview')
  monthOverview(@Req() req: Request & { user: JwtSession }, @Query() q: StatsMonthQueryDto) {
    return this.stats.monthOverview(resolveDiaryScope(req), q.month);
  }

  @Get('emotion-distribution')
  emotionDistribution(@Req() req: Request & { user: JwtSession }, @Query() q: StatsMonthQueryDto) {
    return this.stats.emotionDistribution(resolveDiaryScope(req), q.month);
  }
}
