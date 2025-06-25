import { Module } from '@nestjs/common';
import { PlanService } from './plan.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanController } from './plan.controller';

@Module({
  controllers: [PlanController],
  providers: [PlanService, PrismaService],
  exports: [PlanService],  // <-- Esto es clave
})
export class PlanModule {}
