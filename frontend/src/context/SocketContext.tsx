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
      reconnection: true,
      reconnectionAttempts: Infinity, // continuously retry reconnecting
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      socketInstance.emit('join_shop', 'sve_main');
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for any data mutation event
    const handleEvent = (type: string) => (data: any) => {
      setLastEvent({ type, payload: data });
    };

    socketInstance.on('DATA_UPDATED', (data) => setLastEvent({ type: 'DATA_UPDATED', payload: data }));
    socketInstance.on('TRANSACTION_CREATED', handleEvent('TRANSACTION_CREATED'));
    socketInstance.on('transaction_created', handleEvent('TRANSACTION_CREATED'));
    socketInstance.on('TRANSACTION_VOIDED', handleEvent('TRANSACTION_VOIDED'));
    socketInstance.on('transaction_voided', handleEvent('TRANSACTION_VOIDED'));
    socketInstance.on('RECEIVABLE_UPDATED', handleEvent('RECEIVABLE_UPDATED'));
    socketInstance.on('receivable_created', handleEvent('RECEIVABLE_UPDATED'));
    socketInstance.on('PAYABLE_UPDATED', handleEvent('PAYABLE_UPDATED'));
    socketInstance.on('payable_created', handleEvent('PAYABLE_UPDATED'));
    socketInstance.on('payment_recorded', handleEvent('PAYMENT_RECORDED'));
    socketInstance.on('customer_updated', handleEvent('CUSTOMER_UPDATED'));
    socketInstance.on('dealer_updated', handleEvent('DEALER_UPDATED'));
    socketInstance.on('expense_created', handleEvent('EXPENSE_CREATED'));
    socketInstance.on('settings_updated', handleEvent('SETTINGS_UPDATED'));

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
