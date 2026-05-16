import { Module } from '@nestjs/common';
import { DevOnlyGuard } from '../../common/guards/dev-only.guard';
import { DebugController } from './debug.controller';

@Module({
  controllers: [DebugController],
  providers: [DevOnlyGuard],
})
export class DebugModule {}
