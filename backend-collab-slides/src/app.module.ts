import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PlanModule } from './plan/plan.module';
import { AuthModule } from './auth/auth.module';
import { ProjectModule } from './project/project.module';
import { SlideModule } from './slide/slide.module';
import { PrismaModule } from './prisma/prisma.module';
import { ExportModule } from './export/export.module';
import { CollabGateway } from './collab/collab.gateway';
import { CollabModule } from './collab/collab.module';


@Module({
  imports: [
    PrismaModule,
    CollabModule,
    UserModule,
    PlanModule,
    AuthModule,
    ProjectModule,
    SlideModule,
    ExportModule,
  ],
  controllers: [AppController],
  providers: [AppService, CollabGateway],
})
export class AppModule {}
