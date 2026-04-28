import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return a no-op when outside provider (e.g. during tests)
    return { showToast: () => {} };
  }
  return ctx;
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bgColors = {
    error: 'bg-accent text-white',
    warning: 'bg-warn text-white',
    success: 'bg-success text-white',
    info: 'bg-accent2 text-white'
  };

  return (
    <div className={`toast-enter flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg max-w-sm ${bgColors[toast.type] || bgColors.info}`}>
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="opacity-80 hover:opacity-100 shrink-0">
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container - fixed top right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-auto">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
