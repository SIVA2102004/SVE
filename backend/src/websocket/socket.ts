import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let ioInstance: SocketIOServer | null = null;

export function initWebSocket(server: HTTPServer, _frontendUrl: string): SocketIOServer {
  ioInstance = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow all Vercel, localhost, and cloud clients
        callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    socket.on('join_shop', (room) => {
      socket.join(room || 'sve_main');
    });
  });

  return ioInstance;
}

export function broadcastEvent(event: string, payload: any) {
  if (ioInstance) {
    // Emit the exact event name
    ioInstance.emit(event, payload);
    // Also emit uppercase version for flexible listener compatibility
    ioInstance.emit(event.toUpperCase(), payload);
    // Generic event to trigger instant re-fetch on all connected screens
    ioInstance.emit('DATA_UPDATED', { event, payload });
  }
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}
