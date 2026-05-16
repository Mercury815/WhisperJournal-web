import { registerAs } from '@nestjs/config';

export default registerAs('audio', () => ({
  defaultType: process.env.AUDIO_DEFAULT_TYPE ?? 'ambient',
}));
