import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { PlanModule } from '../plan/plan.module';
import { MinioModule } from '../minio/minio.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PlanModule,
    MinioModule,
    PrismaModule
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService]  // ✅ Esto permite que otros módulos lo usen
})
export class ExportModule {}
