import { Logger } from '@nestjs/common';
import { SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CollabService } from './collab.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CollabGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly collabService: CollabService) {}

  handleConnection(client: Socket) {
    this.logger.log(`🔌 Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`❌ Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('joinProject')
  handleJoinProject(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() client: Socket
  ) {
    client.join(data.projectId);
    this.logger.log(`👥 Cliente ${client.id} se unió al proyecto ${data.projectId}`);
    this.server.to(data.projectId).emit('userJoined', { clientId: client.id });
  }

  @SubscribeMessage('editSlide')
  async handleEditSlide(
    @MessageBody() data: { projectId: string, slideId: string, changes: any },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.log(`✏ Cliente ${client.id} editó slide ${data.slideId} del proyecto ${data.projectId}`);

    try {
      // Guardar en DB
      const updatedSlide = await this.collabService.updateSlide(data.slideId, data.changes);

      // Reenviar a los demás
      client.to(data.projectId).emit('slideUpdated', {
        slideId: data.slideId,
        changes: data.changes,
        updatedBy: client.id,
      });

      // Confirmar al emisor
      client.emit('slideUpdateConfirmed', {
        slideId: data.slideId,
        updatedSlide,
      });
    } catch (err) {
      this.logger.error(`❌ Error al editar slide ${data.slideId}: ${err.message}`);
      client.emit('slideUpdateError', { slideId: data.slideId, error: err.message });
    }
  }

  @SubscribeMessage('leaveProject')
  handleLeaveProject(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() client: Socket
  ) {
    client.leave(data.projectId);
    this.logger.log(`🚪 Cliente ${client.id} salió del proyecto ${data.projectId}`);
    this.server.to(data.projectId).emit('userLeft', { clientId: client.id });
  }

  @SubscribeMessage('deleteSlide')
  async handleDeleteSlide(
    @MessageBody() data: { projectId: string, slideId: string },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.log(`🗑 Cliente ${client.id} eliminó slide ${data.slideId} del proyecto ${data.projectId}`);

    try {
      // Eliminar en la base de datos
      await this.collabService.deleteSlide(data.slideId);

      // Avisar a los demás
      client.to(data.projectId).emit('slideDeleted', {
        slideId: data.slideId,
        deletedBy: client.id,
      });

      // Confirmar al emisor
      client.emit('slideDeleteConfirmed', {
        slideId: data.slideId,
      });

    } catch (err) {
      this.logger.error(`❌ Error al eliminar slide ${data.slideId}: ${err.message}`);
      client.emit('slideDeleteError', { slideId: data.slideId, error: err.message });
    }
  }

}
