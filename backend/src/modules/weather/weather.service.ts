import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppHttpException } from '../../common/exceptions/app-http.exception';
import { ErrorCodes } from '../../types/error-codes';
import { DebugRuntimeService } from '../../shared/debug-runtime.service';
import { WeatherSnapshotRepository } from '../../persistence/weather-snapshot.repository';
import { mapWmoCodeToWeatherType } from './weather.mapper';
import { mapQweatherIconToWeatherType } from './qweather-icon.mapper';

type CurrentResult = {
  weatherType: string;
  temperature: number | null;
  humidity: number | null;
  source: string;
  location: string;
  capturedAt: string;
};

type QWeatherNowResponse = {
  code?: string;
  now?: {
    obsTime?: string;
    temp?: string;
    humidity?: string;
    icon?: string;
    text?: string;
  };
};

@Injectable()
export class WeatherService {
  private readonly log = new Logger(WeatherService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly debug: DebugRuntimeService,
    private readonly snapshots: WeatherSnapshotRepository,
  ) {}

  degraded(locationLabel: string): CurrentResult {
    const now = new Date().toISOString();
    return {
      weatherType: 'unknown',
      temperature: null,
      humidity: null,
      source: 'degraded',
      location: locationLabel,
      capturedAt: now,
    };
  }

  async fetchCurrent(lat: number, lon: number, locationLabel: string): Promise<CurrentResult> {
    const isDev = this.config.get<string>('env.nodeEnv') === 'development';
    const ov = this.debug.weatherOverride;
    if (isDev && ov) {
      const now = new Date().toISOString();
      return {
        weatherType: ov.weatherType ?? 'unknown',
        temperature: ov.temperature ?? null,
        humidity: ov.humidity ?? null,
        source: 'debug',
        location: locationLabel,
        capturedAt: now,
      };
    }

    const apiKey = this.config.get<string>('weather.apiKey') ?? '';
    const apiHost = this.config.get<string>('weather.apiHost') ?? 'https://devapi.qweather.com';

    if (apiKey) {
      const q = await this.fetchQWeatherNow(lat, lon, locationLabel, apiHost, apiKey);
      if (q) {
        return q;
      }
      this.log.warn({ action: 'weather.qweather.fallback_open_meteo' });
    }

    return this.fetchOpenMeteo(lat, lon, locationLabel);
  }

  /** 和风天气实时天气 v7 */
  private async fetchQWeatherNow(
    lat: number,
    lon: number,
    locationLabel: string,
    apiHost: string,
    apiKey: string,
  ): Promise<CurrentResult | null> {
    const location = `${Number(lon.toFixed(2))},${Number(lat.toFixed(2))}`;
    const url = `${apiHost}/v7/weather/now?location=${encodeURIComponent(location)}&key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip' },
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json()) as QWeatherNowResponse;
      if (String(data.code) !== '200' || !data.now) {
        this.log.warn({ action: 'weather.qweather.bad_response', code: data.code, body: data });
        return null;
      }
      const now = data.now;
      const icon = now.icon ?? '999';
      const weatherType = mapQweatherIconToWeatherType(icon);
      const temp = now.temp !== undefined ? parseFloat(now.temp) : null;
      const humidity = now.humidity !== undefined ? parseFloat(now.humidity) : null;
      const capturedAt = now.obsTime ? new Date(now.obsTime) : new Date();

      const row = this.snapshots.buildFromCurrent({
        location: locationLabel,
        weatherType,
        temperature: Number.isFinite(temp as number) ? temp : null,
        humidity: Number.isFinite(humidity as number) ? humidity : null,
        source: 'qweather',
        capturedAt,
      });
      await this.snapshots.saveSnapshot(row);

      return {
        weatherType,
        temperature: Number.isFinite(temp as number) ? temp : null,
        humidity: Number.isFinite(humidity as number) ? humidity : null,
        source: 'qweather',
        location: locationLabel,
        capturedAt: capturedAt.toISOString(),
      };
    } catch (e) {
      this.log.warn({ action: 'weather.qweather.fetch_failed', err: e });
      return null;
    }
  }

  private async fetchOpenMeteo(
    lat: number,
    lon: number,
    locationLabel: string,
  ): Promise<CurrentResult> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        throw new Error(`open-meteo ${res.status}`);
      }
      const data = (await res.json()) as {
        current?: {
          temperature_2m?: number;
          relative_humidity_2m?: number;
          weather_code?: number;
          time?: string;
        };
      };
      const c = data.current;
      const code = c?.weather_code ?? 0;
      const weatherType = mapWmoCodeToWeatherType(code);
      const capturedAt = c?.time ? new Date(c.time) : new Date();
      const row = this.snapshots.buildFromCurrent({
        location: locationLabel,
        weatherType,
        temperature: c?.temperature_2m ?? null,
        humidity: c?.relative_humidity_2m ?? null,
        source: 'open-meteo',
        capturedAt,
      });
      await this.snapshots.saveSnapshot(row);

      return {
        weatherType,
        temperature: c?.temperature_2m ?? null,
        humidity: c?.relative_humidity_2m ?? null,
        source: 'open-meteo',
        location: locationLabel,
        capturedAt: capturedAt.toISOString(),
      };
    } catch (e) {
      this.log.warn({ action: 'weather.fetch_failed', err: e });
      return this.degraded(locationLabel);
    }
  }

  async getSnapshotByDateKey(dateKey: string, location: string): Promise<Record<string, unknown>> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new AppHttpException(
        ErrorCodes.VALIDATION_ERROR,
        'dateKey 应为 YYYY-MM-DD',
        HttpStatus.BAD_REQUEST,
      );
    }
    const row = await this.snapshots.findLatestForDay(location, dateKey);

    if (row) {
      return {
        id: row.id,
        location: row.location,
        weatherType: row.weatherType,
        temperature: row.temperature,
        humidity: row.humidity,
        source: row.source,
        capturedAt: row.capturedAt.toISOString(),
      };
    }

    return {
      weatherType: 'unknown',
      temperature: null,
      humidity: null,
      source: 'degraded',
      location,
      dateKey,
    };
  }
}
