import { io, Socket } from 'socket.io-client';
import { createApiUrl } from './config';

let socket: Socket | null = null;

export const connectSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('access_token');
    socket = io(createApiUrl('/'), {
      auth: {
        token,
      },
      transports: ['websocket'],
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    throw new Error('Socket no inicializado. Llama a connectSocket primero.');
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
