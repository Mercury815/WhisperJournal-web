import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { RegisteredUserGuard } from '../../common/guards/registered-user.guard';
import type { JwtSession } from '../../common/utils/session.util';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UserService } from './user.service';

@Controller('settings')
@UseGuards(AuthGuard('jwt'), RegisteredUserGuard)
export class SettingsController {
  constructor(private readonly users: UserService) {}

  @Get()
  get(@Req() req: Request & { user: JwtSession }) {
    return this.users.getSettings(req.user.user!.id);
  }

  @Put()
  put(@Req() req: Request & { user: JwtSession }, @Body() dto: UpdateSettingsDto) {
    return this.users.updateSettings(req.user.user!.id, dto);
  }
}
