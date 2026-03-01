import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useWebSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('sensor-data', (data) => {
      setLastMessage({ type: 'sensor-data', data });
    });

    socketInstance.on('high-severity-alert', (data) => {
      setLastMessage({ type: 'high-severity-alert', data });
    });

    socketInstance.on('gps-update', (data) => {
      setLastMessage({ type: 'gps-update', data });
    });

    socketInstance.on('initial-impacts', (data) => {
      setLastMessage({ type: 'initial-impacts', data });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const emit = (event, data) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  return { isConnected, lastMessage, emit };
};
