import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MinioModule } from '../minio/minio.module';
import { ExportModule } from '../export/export.module';  // ✅ Importa el módulo exportador

@Module({
  imports: [
    MinioModule,
    ExportModule  // ✅ Ahora ProjectModule podrá usar ExportService
  ],
  controllers: [ProjectController],
  providers: [ProjectService, PrismaService],
})
export class ProjectModule {}
