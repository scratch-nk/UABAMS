import React, { createContext, useState, useContext } from 'react';

const AlertContext = createContext();

export const useAlerts = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addAlert = (alert) => {
    const newAlert = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      read: false,
      ...alert
    };
    setAlerts(prev => [newAlert, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  const markAsRead = (alertId) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(alert => ({ ...alert, read: true })));
    setUnreadCount(0);
  };

  const clearAlerts = () => {
    setAlerts([]);
    setUnreadCount(0);
  };

  const value = {
    alerts,
    unreadCount,
    addAlert,
    markAsRead,
    markAllAsRead,
    clearAlerts
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
};
