import { Controller, Get, Param, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { RegisteredUserGuard } from '../../common/guards/registered-user.guard';
import type { JwtSession } from '../../common/utils/session.util';
import { UserService } from '../user/user.service';
import { WeatherCurrentQueryDto } from './dto/weather-query.dto';
import { WeatherLocationDto } from './dto/weather-location.dto';
import { WeatherService } from './weather.service';

const DEFAULT_LABEL = 'default';
const DEFAULT_LAT = 39.9042;
const DEFAULT_LON = 116.4074;

@Controller('weather')
export class WeatherController {
  constructor(
    private readonly weather: WeatherService,
    private readonly users: UserService,
  ) {}

  /** 无需登录；无坐标时使用默认城市坐标并降级可失败 */
  @Get('current')
  async current(@Query() q: WeatherCurrentQueryDto) {
    const lat = q.lat ?? DEFAULT_LAT;
    const lon = q.lon ?? DEFAULT_LON;
    const label = q.location?.trim() || DEFAULT_LABEL;
    return this.weather.fetchCurrent(lat, lon, label);
  }

  @Get('snapshot/:dateKey')
  snapshot(@Param('dateKey') dateKey: string, @Query('location') location?: string) {
    return this.weather.getSnapshotByDateKey(dateKey, (location ?? DEFAULT_LABEL).trim());
  }

  @Post('location')
  @UseGuards(AuthGuard('jwt'), RegisteredUserGuard)
  async saveLocation(@Req() req: Request & { user: JwtSession }, @Body() dto: WeatherLocationDto) {
    await this.users.updateSettings(req.user.user!.id, {
      weatherLocation: { label: dto.label, lat: dto.lat, lon: dto.lon },
    });
    return { ok: true };
  }
}
