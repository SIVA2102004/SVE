import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let ioInstance: SocketIOServer | null = null;

export function initWebSocket(server: HTTPServer, frontendUrl: string): SocketIOServer {
  ioInstance = new SocketIOServer(server, {
    cors: {
      origin: frontendUrl || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    // console.log(`🔌 Client connected to ShopFlow real-time hub: ${socket.id}`);

    socket.on('join_shop', (room) => {
      socket.join(room || 'shopflow_main');
    });

    socket.on('disconnect', () => {
      // console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

export function broadcastEvent(event: string, payload: any) {
  if (ioInstance) {
    ioInstance.emit(event, payload);
  }
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}
