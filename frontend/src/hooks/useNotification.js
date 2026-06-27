import { useCallback, useContext } from 'react';
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

  const success = useCallback((message, duration = 3000) => addNotification(message, 'success', duration), [addNotification]);
  const error = useCallback((message, duration = 5000) => addNotification(message, 'error', duration), [addNotification]);
  const warning = useCallback((message, duration = 4000) => addNotification(message, 'warning', duration), [addNotification]);
  const info = useCallback((message, duration = 3000) => addNotification(message, 'info', duration), [addNotification]);
  const loading = useCallback((message) => addNotification(message, 'loading', 0), [addNotification]);

  return { success, error, warning, info, loading };
}
