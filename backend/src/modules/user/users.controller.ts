import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { RegisteredUserGuard } from '../../common/guards/registered-user.guard';
import type { JwtSession } from '../../common/utils/session.util';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RegisteredUserGuard)
export class UsersController {
  constructor(private readonly users: UserService) {}

  @Get('me')
  me(@Req() req: Request & { user: JwtSession }) {
    return this.users.getMe(req.user.user!.id);
  }
}
