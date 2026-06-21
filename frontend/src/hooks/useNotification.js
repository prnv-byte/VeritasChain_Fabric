import { useContext } from 'react';
import { NotificationContext } from '../context/NotificationContext';

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

export function useToast() {
  const { addNotification } = useNotification();

  return {
    success: (message, duration = 3000) => addNotification(message, 'success', duration),
    error: (message, duration = 5000) => addNotification(message, 'error', duration),
    warning: (message, duration = 4000) => addNotification(message, 'warning', duration),
    info: (message, duration = 3000) => addNotification(message, 'info', duration),
    loading: (message) => addNotification(message, 'loading', 0),
  };
}
