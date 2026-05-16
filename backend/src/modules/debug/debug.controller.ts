import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DevOnlyGuard } from '../../common/guards/dev-only.guard';
import { DebugRuntimeService } from '../../shared/debug-runtime.service';
import { DebugEnvironmentDto } from './dto/debug-env.dto';
import { DebugTransitionDto } from './dto/debug-transition.dto';

@Controller()
@UseGuards(DevOnlyGuard)
export class DebugController {
  constructor(private readonly runtime: DebugRuntimeService) {}

  @Get('config/debug')
  getConfig() {
    return {
      weatherOverride: this.runtime.weatherOverride ?? null,
      timeOffsetMs: this.runtime.timeOffsetMs,
      transitionTrigger: this.runtime.transitionTrigger ?? null,
    };
  }

  @Post('debug/environment')
  setEnv(@Body() dto: DebugEnvironmentDto) {
    if (dto.weatherType !== undefined || dto.temperature !== undefined || dto.humidity !== undefined) {
      this.runtime.weatherOverride = {
        ...this.runtime.weatherOverride,
        weatherType: dto.weatherType ?? this.runtime.weatherOverride?.weatherType,
        temperature: dto.temperature ?? this.runtime.weatherOverride?.temperature,
        humidity: dto.humidity ?? this.runtime.weatherOverride?.humidity,
      };
    }
    if (dto.timeOffsetMs !== undefined) {
      this.runtime.timeOffsetMs = dto.timeOffsetMs;
    }
    return this.getConfig();
  }

  @Post('debug/transition')
  setTransition(@Body() dto: DebugTransitionDto) {
    this.runtime.transitionTrigger = dto.trigger ?? 'default';
    return { ok: true, trigger: this.runtime.transitionTrigger };
  }
}
