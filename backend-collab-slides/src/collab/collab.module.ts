import { Module } from '@nestjs/common';
import { CollabGateway } from './collab.gateway';
import { CollabService } from './collab.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [CollabGateway, CollabService, PrismaService],
  exports: [CollabService],  // En caso lo uses en otros módulos
})
export class CollabModule {}
