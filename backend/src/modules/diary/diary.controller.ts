import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { resolveDiaryScope, type JwtSession } from '../../common/utils/session.util';
import { CreateDiaryDto } from './dto/create-diary.dto';
import { ListDiaryQueryDto } from './dto/list-diary.query';
import { SyncDiaryDto } from './dto/sync-diary.dto';
import { UpdateDiaryDto } from './dto/update-diary.dto';
import { DiaryService } from './diary.service';

@Controller('diary')
@UseGuards(AuthGuard('jwt'))
export class DiaryController {
  constructor(private readonly diary: DiaryService) {}

  @Post()
  create(@Req() req: Request & { user: JwtSession }, @Body() dto: CreateDiaryDto) {
    return this.diary.create(resolveDiaryScope(req), dto);
  }

  @Post('sync')
  sync(@Req() req: Request & { user: JwtSession }, @Body() dto: SyncDiaryDto) {
    return this.diary.sync(resolveDiaryScope(req), dto);
  }

  @Get()
  list(@Req() req: Request & { user: JwtSession }, @Query() q: ListDiaryQueryDto) {
    return this.diary.list(resolveDiaryScope(req), q);
  }

  @Get(':id')
  getOne(@Req() req: Request & { user: JwtSession }, @Param('id', ParseUUIDPipe) id: string) {
    return this.diary.getOne(resolveDiaryScope(req), id);
  }

  @Put(':id')
  update(
    @Req() req: Request & { user: JwtSession },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiaryDto,
  ) {
    return this.diary.update(resolveDiaryScope(req), id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request & { user: JwtSession }, @Param('id', ParseUUIDPipe) id: string) {
    return this.diary.remove(resolveDiaryScope(req), id);
  }

  @Post(':id/restore')
  restore(@Req() req: Request & { user: JwtSession }, @Param('id', ParseUUIDPipe) id: string) {
    return this.diary.restore(resolveDiaryScope(req), id);
  }
}
