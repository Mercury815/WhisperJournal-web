import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { UsersController } from './users.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UsersController, SettingsController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
