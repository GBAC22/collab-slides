import { Test, TestingModule } from '@nestjs/testing';
import { SlideController } from './slide.controller';

describe('SlideController', () => {
  let controller: SlideController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlideController],
    }).compile();

    controller = module.get<SlideController>(SlideController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
