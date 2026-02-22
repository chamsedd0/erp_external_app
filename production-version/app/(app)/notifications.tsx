import { View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { Bell, Check, Clock, DollarSign, X } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiClient } from '../../api/client';
import { useSession } from '../../providers/auth-context';
import { useToast } from '../../providers/toast-context';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'request_approved' | 'request_rejected' | 'system';
    read: boolean;
    timestamp: string;
    targetId?: string;
    targetType?: 'time_off' | 'expense';
}

export default function Notifications() {
    const { user } = useSession();
    const router = useRouter();
    const toast = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const semanticSuccess = useColor('semanticSuccess' as any);
    const semanticWarning = useColor('semanticWarning' as any);
    const semanticError = useColor('semanticError' as any);
    const semanticInfo = useColor('semanticInfo' as any);
    // const pastelOrange = useColor('pastelOrangeText' as any); // If needed

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [])
    );

    const fetchNotifications = async () => {
        if (!user?.id) return;
        try {
            const data = await apiClient.getNotifications(user.id);
            setNotifications(data.notifications || []);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            // Don't show toast on background fetch to avoid annoyance
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const markAsRead = async (notification: Notification) => {
        if (notification.read) return;

        // Optimistic update
        setNotifications(prev =>
            prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );

        try {
            await apiClient.markNotificationRead(notification.id);
        } catch (error) {
            console.error(error);
        }
    };

    const handlePress = async (notification: Notification) => {
        markAsRead(notification);

        if (notification.targetId && notification.targetType) {
            router.push({
                pathname: '/(app)/request-details',
                params: { id: notification.targetId, type: notification.targetType }
            });
        }
    };

    const getNotificationColor = (type: Notification['type'], targetType?: string) => {
        switch (type) {
            case 'request_approved': return semanticSuccess; // Green
            case 'request_rejected': return semanticError; // Red
            default:
                if (targetType === 'time_off') return semanticInfo; // Blue
                if (targetType === 'expense') return semanticSuccess; // Green
                return semanticInfo; // Fallback
        }
    };

    const getNotificationIcon = (type: Notification['type'], targetType?: string) => {
        const color = getNotificationColor(type, targetType);
        if (type === 'request_approved') return <Check size={20} color={color} strokeWidth={3} />;
        if (type === 'request_rejected') return <X size={20} color={color} strokeWidth={3} />;
        if (targetType === 'time_off') return <Clock size={20} color={color} strokeWidth={2.5} />;
        if (targetType === 'expense') return <DollarSign size={20} color={color} strokeWidth={2.5} />;
        return <Bell size={20} color={color} strokeWidth={2.5} />;
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);

        if (hours < 24 && now.getDate() === date.getDate()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        if (hours < 48 && now.getDate() - date.getDate() === 1) {
            return 'Yesterday';
        }

        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const groupNotifications = (notifs: Notification[]) => {
        const groups: { [key: string]: Notification[] } = {};

        notifs.forEach(n => {
            const date = new Date(n.timestamp);
            const now = new Date();
            let key = 'Earlier';

            if (date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
                key = 'Today';
            } else if (new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString()) {
                key = 'Yesterday';
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(n);
        });

        // Sort keys: Today, Yesterday, Earlier
        return Object.entries(groups).sort((a, b) => {
            if (a[0] === 'Today') return -1;
            if (b[0] === 'Today') return 1;
            if (a[0] === 'Yesterday') return -1;
            if (b[0] === 'Yesterday') return 1;
            return 0;
        });
    };

    const groupedNotifications = groupNotifications(notifications);
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <View style={{ flex: 1, backgroundColor: background }}>
            <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={{ marginBottom: 24, marginTop: 10, paddingHorizontal: 4 }}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 32, color: text, marginBottom: 4 }}>
                        Inbox
                    </Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>
                        {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                    </Text>
                </View>

                {loading && !refreshing && notifications.length === 0 ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={muted} />
                    </View>
                ) : notifications.length === 0 ? (
                    <View style={{ paddingVertical: 100, alignItems: 'center', opacity: 0.5 }}>
                        <Bell size={64} color={muted} />
                        <Text style={{ marginTop: 20, fontFamily: 'DMSans_500Medium', fontSize: 18, color: text }}>No notifications</Text>
                        <Text style={{ marginTop: 8, fontFamily: 'DMSans_400Regular', color: muted, textAlign: 'center', maxWidth: 250 }}>
                            You're all caught up! Updates on your requests will appear here.
                        </Text>
                    </View>
                ) : (
                    <View style={{ gap: 24 }}>
                        {groupedNotifications.map(([date, items]) => (
                            <View key={date}>
                                <Text style={{
                                    fontFamily: 'DMSans_700Bold',
                                    fontSize: 14,
                                    color: muted,
                                    marginBottom: 12,
                                    textTransform: 'uppercase',
                                    letterSpacing: 1,
                                    paddingHorizontal: 4
                                }}>
                                    {date}
                                </Text>
                                <View style={{ backgroundColor: cardColor, borderRadius: 24, overflow: 'hidden' }}>
                                    {items.map((item, index) => (
                                        <View key={item.id}>
                                            <TouchableOpacity
                                                onPress={() => handlePress(item)}
                                                activeOpacity={0.7}
                                                style={{
                                                    flexDirection: 'row',
                                                    padding: 16,
                                                    backgroundColor: item.read ? 'transparent' : `${pastelPurple}10`, // Slight highlight for unread
                                                    alignItems: 'flex-start',
                                                    gap: 16
                                                }}
                                            >
                                                {/* Left Icon (Avatar) */}
                                                <View style={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: 24,
                                                    backgroundColor: 'transparent',
                                                    borderWidth: 1,
                                                    borderColor: getNotificationColor(item.type, item.targetType),
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginTop: 2
                                                }}>
                                                    {getNotificationIcon(item.type, item.targetType)}
                                                </View>

                                                {/* Content */}
                                                <View style={{ flex: 1, gap: 4 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <Text style={{
                                                            fontFamily: item.read ? 'Outfit_500Medium' : 'Outfit_700Bold',
                                                            fontSize: 17,
                                                            color: text,
                                                            flex: 1,
                                                            marginRight: 8
                                                        }}>
                                                            {item.title}
                                                        </Text>
                                                        <Text style={{
                                                            fontFamily: 'DMSans_500Medium',
                                                            fontSize: 12,
                                                            color: item.read ? muted : text,
                                                            opacity: item.read ? 0.7 : 1
                                                        }}>
                                                            {formatTime(item.timestamp)}
                                                        </Text>
                                                    </View>

                                                    <Text
                                                        numberOfLines={2}
                                                        style={{
                                                            fontFamily: item.read ? 'DMSans_400Regular' : 'DMSans_500Medium',
                                                            fontSize: 15,
                                                            color: item.read ? muted : text,
                                                            lineHeight: 22
                                                        }}
                                                    >
                                                        {item.message}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                            {index < items.length - 1 && (
                                                <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: 80 }} />
                                            )}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
