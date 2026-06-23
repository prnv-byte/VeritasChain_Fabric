import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info, Loader } from 'lucide-react';
import { useNotification } from '../hooks/useNotification';
import '../styles/notifications.css';

export function NotificationContainer() {
  const { notifications, removeNotification } = useNotification();

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'loading':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBackground = (type) => {
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-green-400/20 to-green-500/20 border-green-400/30';
      case 'error':
        return 'bg-gradient-to-r from-red-400/20 to-red-500/20 border-red-400/30';
      case 'warning':
        return 'bg-gradient-to-r from-yellow-400/20 to-yellow-500/20 border-yellow-400/30';
      case 'loading':
        return 'bg-gradient-to-r from-blue-400/20 to-blue-500/20 border-blue-400/30';
      default:
        return 'bg-gradient-to-r from-blue-400/20 to-blue-500/20 border-blue-400/30';
    }
  };

  return (
    <div className="notification-container">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            transition={{ duration: 0.3 }}
            className={`notification glass-card ${getBackground(notification.type)} border`}
          >
            <div className="flex items-center gap-3 flex-1">
              {getIcon(notification.type)}
              <span className="text-white text-sm font-medium">{notification.message}</span>
            </div>
            {notification.type !== 'loading' && (
              <button
                onClick={() => removeNotification(notification.id)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
