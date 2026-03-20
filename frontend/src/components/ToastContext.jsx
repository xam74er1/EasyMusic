import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, Info, CheckCircle, AlertCircle } from 'lucide-react';
import './Toast.css';

const ToastContext = createContext();

let toastIdCounter = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = ++toastIdCounter;
        setToasts(prev => [...prev, { id, message, type, exiting: false }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300); // Wait for transition
    }, []);

    const getIcon = (type) => {
        if (type === 'success') return <CheckCircle size={18} color="#4CAF50" />;
        if (type === 'error') return <AlertCircle size={18} color="#f44336" />;
        return <Info size={18} color="#2196F3" />;
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast ${toast.type} ${toast.exiting ? 'exiting' : ''}`}>
                        {getIcon(toast.type)}
                        <span style={{ flex: 1 }}>{toast.message}</span>
                        <button className="toast-close" onClick={() => removeToast(toast.id)}>
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
