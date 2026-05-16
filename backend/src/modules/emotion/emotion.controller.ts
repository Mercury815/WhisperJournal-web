import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { resolveDiaryScope, type JwtSession } from '../../common/utils/session.util';
import { RecognizeDto } from './dto/recognize.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { EmotionService } from './emotion.service';

@Controller('emotion')
export class EmotionController {
  constructor(private readonly emotion: EmotionService) {}

  @Get('dictionary')
  dictionary(@Query('locale') locale?: string) {
    return this.emotion.listDictionary(locale);
  }

  @Post('recognize')
  recognize(@Body() dto: RecognizeDto) {
    return this.emotion.recognize(dto.text, dto.locale ?? 'zh-CN');
  }

  @Post('feedback')
  @UseGuards(AuthGuard('jwt'))
  feedback(@Req() req: Request & { user: JwtSession }, @Body() dto: FeedbackDto) {
    return this.emotion.feedback(resolveDiaryScope(req), dto.diaryId, dto.emotions, dto.primaryEmotion);
  }
}
