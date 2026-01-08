import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { Bell, Check } from 'lucide-react-native';
import { useState } from 'react';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'request_approved' | 'request_rejected' | 'system';
    read: boolean;
    timestamp: Date;
}

// Mock data for now
const mockNotifications: Notification[] = [
    {
        id: '1',
        title: 'Time Off Approved',
        message: 'Your vacation request for Dec 20-25 has been approved',
        type: 'request_approved',
        read: false,
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    },
    {
        id: '2',
        title: 'Expense Submitted',
        message: 'Your expense claim of $250 has been received',
        type: 'system',
        read: false,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
        id: '3',
        title: 'Welcome!',
        message: 'Welcome to the Employee Portal. Get started by submitting your first request.',
        type: 'system',
        read: true,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    },
];

export default function Notifications() {
    const [notifications, setNotifications] = useState(mockNotifications);
    const [refreshing, setRefreshing] = useState(false);
    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const pastelPurple = useColor('pastelPurple' as any);

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const getNotificationColor = (type: Notification['type']) => {
        switch (type) {
            case 'request_approved':
                return '#10b981';
            case 'request_rejected':
                return '#ef4444';
            default:
                return '#3b82f6';
        }
    };

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    const renderNotification = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            onPress={() => !item.read && markAsRead(item.id)}
            style={{
                backgroundColor: cardColor,
                borderRadius: 20,
                padding: 20,
                marginBottom: 12,
                borderLeftWidth: 4,
                borderLeftColor: item.read ? 'transparent' : getNotificationColor(item.type),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: item.read ? 0.03 : 0.08,
                shadowRadius: 8,
                elevation: item.read ? 1 : 3,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: item.read ? 'rgba(0,0,0,0.05)' : `${getNotificationColor(item.type)}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Bell size={20} color={item.read ? muted : getNotificationColor(item.type)} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{
                            fontSize: 16,
                            fontWeight: item.read ? '600' : '700',
                            color: text,
                            flex: 1,
                        }}>
                            {item.title}
                        </Text>
                        {!item.read && (
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: getNotificationColor(item.type),
                                marginLeft: 8,
                                marginTop: 6,
                            }} />
                        )}
                    </View>
                    <Text style={{
                        fontSize: 14,
                        color: muted,
                        marginBottom: 8,
                        opacity: item.read ? 0.7 : 1,
                    }}>
                        {item.message}
                    </Text>
                    <Text style={{ fontSize: 12, color: muted, opacity: 0.6 }}>
                        {formatTime(item.timestamp)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <View style={{ flex: 1, backgroundColor: background }}>
            <ScrollView
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 32, fontWeight: 'bold', color: text, marginBottom: 8 }}>
                        Notifications
                    </Text>
                    {unreadCount > 0 && (
                        <Text style={{ fontSize: 15, color: muted }}>
                            You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                        </Text>
                    )}
                </View>

                {/* Notifications List */}
                {notifications.length === 0 ? (
                    <View style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 80,
                    }}>
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: cardColor,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 16,
                        }}>
                            <Bell size={36} color={muted} />
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: '600', color: text, marginBottom: 8 }}>
                            No notifications
                        </Text>
                        <Text style={{ fontSize: 14, color: muted, textAlign: 'center' }}>
                            You're all caught up!
                        </Text>
                    </View>
                ) : (
                    <View>
                        {notifications.map(item => (
                            <View key={item.id}>
                                {renderNotification({ item })}
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
