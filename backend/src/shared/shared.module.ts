import { Global, Module } from '@nestjs/common';
import { DebugRuntimeService } from './debug-runtime.service';

@Global()
@Module({
  providers: [DebugRuntimeService],
  exports: [DebugRuntimeService],
})
export class SharedModule {}
