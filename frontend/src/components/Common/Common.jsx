import React from 'react';

export function GlassCard({ children, className = '' }) {
  return (
    <div className={`glass p-6 sm:p-8 ${className}`}>
      {children}
    </div>
  );
}

export function Modal({ isOpen, onClose, title, children, actions }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {title && <h2 className="text-xl font-bold mb-4">{title}</h2>}
        {children}
        {actions && (
          <div className="flex gap-3 justify-end mt-6">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = 'md' }) {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }[size];

  return <div className={`spinner ${sizeClass}`} />;
}

export function Toast({ message, type = 'info', onClose }) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`}>
      {message}
    </div>
  );
}