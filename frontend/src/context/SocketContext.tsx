import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  lastEvent: { type: string; payload: any } | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  lastEvent: null,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ type: string; payload: any } | null>(null);

  useEffect(() => {
    const backendUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : 'https://sve-filx.onrender.com');

    const socketInstance = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('TRANSACTION_CREATED', (data) => {
      setLastEvent({ type: 'TRANSACTION_CREATED', payload: data });
    });

    socketInstance.on('TRANSACTION_VOIDED', (data) => {
      setLastEvent({ type: 'TRANSACTION_VOIDED', payload: data });
    });

    socketInstance.on('RECEIVABLE_UPDATED', (data) => {
      setLastEvent({ type: 'RECEIVABLE_UPDATED', payload: data });
    });

    socketInstance.on('PAYABLE_UPDATED', (data) => {
      setLastEvent({ type: 'PAYABLE_UPDATED', payload: data });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, lastEvent }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
