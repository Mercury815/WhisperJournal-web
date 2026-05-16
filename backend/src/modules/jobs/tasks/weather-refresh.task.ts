import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WeatherService } from '../../weather/weather.service';

const DEFAULT_LAT = 39.9042;
const DEFAULT_LON = 116.4074;
const LABEL = 'scheduled-default';

/** 定时拉取一次默认坐标天气，写入快照表（失败时服务内已降级） */
@Injectable()
export class WeatherRefreshTask {
  private readonly log = new Logger(WeatherRefreshTask.name);

  constructor(private readonly weather: WeatherService) {}

  @Cron('0 */15 * * * *')
  async run(): Promise<void> {
    try {
      await this.weather.fetchCurrent(DEFAULT_LAT, DEFAULT_LON, LABEL);
      this.log.log({ action: 'weather.refresh.ok' });
    } catch (e) {
      this.log.warn({ action: 'weather.refresh.fail', err: e });
    }
  }
}
