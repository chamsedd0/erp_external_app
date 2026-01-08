import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text } from '../components/ui/text';
import { useColor } from '@/hooks/useColor';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react-native';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const background = useColor('background');
    const cardColor = useColor('card');

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now().toString();
        const newToast = { id, message, type };

        setToasts(prev => [...prev, newToast]);

        // Auto dismiss after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const success = useCallback((message: string) => showToast(message, 'success'), [showToast]);
    const error = useCallback((message: string) => showToast(message, 'error'), [showToast]);
    const warning = useCallback((message: string) => showToast(message, 'warning'), [showToast]);
    const info = useCallback((message: string) => showToast(message, 'info'), [showToast]);

    const getToastConfig = (type: ToastType) => {
        switch (type) {
            case 'success':
                return { icon: CheckCircle, color: '#10b981', bgColor: '#d1fae5' };
            case 'error':
                return { icon: XCircle, color: '#ef4444', bgColor: '#fee2e2' };
            case 'warning':
                return { icon: AlertCircle, color: '#f59e0b', bgColor: '#fef3c7' };
            case 'info':
            default:
                return { icon: Info, color: '#3b82f6', bgColor: '#dbeafe' };
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
            {children}
            <View style={styles.toastContainer} pointerEvents="box-none">
                {toasts.map((toast) => {
                    const config = getToastConfig(toast.type);
                    const Icon = config.icon;

                    return (
                        <Animated.View
                            key={toast.id}
                            style={[
                                styles.toast,
                                {
                                    backgroundColor: cardColor,
                                    borderLeftColor: config.color,
                                    shadowColor: '#000',
                                }
                            ]}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
                                <Icon size={20} color={config.color} strokeWidth={2.5} />
                            </View>
                            <Text style={styles.toastText}>{toast.message}</Text>
                        </Animated.View>
                    );
                })}
            </View>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 60,
        left: 24,
        right: 24,
        zIndex: 9999,
        gap: 12,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderLeftWidth: 4,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
        gap: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toastText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
    },
});
