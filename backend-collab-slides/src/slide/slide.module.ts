import { Module } from '@nestjs/common';
import { SlideService } from './slide.service';
import { SlideController } from './slide.controller';

@Module({
  providers: [SlideService],
  controllers: [SlideController]
})
export class SlideModule {}
