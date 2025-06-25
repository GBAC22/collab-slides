import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' }
})
export class CollabGateway {
  @SubscribeMessage('joinProject')
  handleJoin(@MessageBody() projectId: string, @ConnectedSocket() client: Socket) {
    client.join(projectId);
    client.emit('joined', projectId);
  }

  @SubscribeMessage('editSlide')
  handleEdit(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    client.to(data.projectId).emit('slideEdited', data);
  }
}
