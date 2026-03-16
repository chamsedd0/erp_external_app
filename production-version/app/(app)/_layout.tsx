import { Tabs, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, TouchableOpacity, Platform, TextInput, Pressable } from 'react-native';
import { Home, Plus, User, Bell, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColor } from '../../hooks/useColor';
import * as Notifications from 'expo-notifications';
import { useSession } from '../../providers/auth-context';
import { apiClient } from '../../api/client';

export default function AppLayout() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useSession();
    const [hasUnread, setHasUnread] = useState(false);

    // Fetch unread notification count on mount — badge dot only shown when > 0
    useEffect(() => {
        if (!user?.id) return;
        apiClient.getNotifications(user.id)
            .then((data: any) => {
                const unread = (data.notifications || []).filter((n: any) => !n.read);
                setHasUnread(unread.length > 0);
            })
            .catch(() => {});
    }, [user?.id]);

    // Handle notification taps → navigate to the relevant request detail screen
    useEffect(() => {
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data as any;
            if (data?.targetId && data?.targetType) {
                router.push({
                    pathname: '/(app)/request-details',
                    params: { id: String(data.targetId), type: data.targetType },
                });
            }
        });
        return () => subscription.remove();
    }, []);
    const backgroundColor = useColor('background');
    const cardColor = useColor('card');
    const text = useColor('text');
    const primary = useColor('primary');
    const muted = useColor('textMuted');

    return (
        <Tabs

            screenOptions={{
                headerShown: true,
                header: () => (
                    <View
                        style={{
                            paddingTop: insets.top + 30,
                            paddingHorizontal: 20,
                            paddingBottom: 0,
                            backgroundColor: backgroundColor, // Match app background "no bg look"
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                        }}
                    >
                        {/* Search Pill */}
                        <Pressable onPress={() => router.push('/(app)/search')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: cardColor, borderRadius: 100, paddingHorizontal: 16, height: 44 }}>
                            <Search size={18} color={muted} style={{ marginRight: 8 }} />
                            <TextInput
                                placeholder="Search..."
                                placeholderTextColor={muted}
                                style={{ flex: 1, height: '100%', color: text, backgroundColor: 'transparent' }}
                                editable={false}
                                pointerEvents="none"
                            />
                        </Pressable>

                        {/* Notification Bell */}
                        <TouchableOpacity onPress={() => router.push('/(app)/notifications')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                            <Bell size={24} color={text} />
                            {/* Optional: Red dot for notifications */}
                            <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red', borderWidth: 1, borderColor: backgroundColor }} />
                        </TouchableOpacity>
                    </View>
                ),

                tabBarStyle: {
                    position: 'absolute',
                    bottom: 0, // Respect safe area
                    borderWidth: 0.1,
                    borderColor: 'rgba(255, 255, 255, 0.28)',
                    height: 115,
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    backgroundColor: cardColor,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.1,
                    shadowRadius: 20,
                    elevation: 10,
                    paddingBottom: 0,
                    paddingTop: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                tabBarShowLabel: false, // Cleaner look without labels for modern feel? User asked to improve design.
                tabBarActiveTintColor: primary,
                tabBarInactiveTintColor: muted,
                tabBarItemStyle: {
                    height: 55,
                    borderBottomColor: '#2c2c2cff',
                    borderBottomWidth: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                }
            }}
        >
            {/* Hidden screens - accessible via navigation but not in tab bar */}
            <Tabs.Screen
                name="notifications"
                options={{
                    href: null, // Hide from tab bar
                }}
            />
            <Tabs.Screen
                name="help"
                options={{
                    href: null, // Hide from tab bar
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    href: null, // Hide from tab bar
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    href: null, // Hide from tab bar
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="request-details"
                options={{
                    href: null, // Hide from tab bar
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="timesheet"
                options={{
                    href: null, // Hide from tab bar — accessed via new-request hub
                    headerShown: false,
                }}
            />

            {/* Visible tabs */}
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={{ alignItems: 'center', justifyContent: 'center', top: Platform.OS === 'ios' ? 10 : 0 }}>
                            <Home size={28} color={color} strokeWidth={focused ? 3 : 2} />
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="new-request"
                options={{
                    title: 'New Request',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={{ alignItems: 'center', justifyContent: 'center', top: Platform.OS === 'ios' ? 10 : 0 }}>
                            <Plus size={28} color={color} strokeWidth={focused ? 3 : 2} />
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={{ alignItems: 'center', justifyContent: 'center', top: Platform.OS === 'ios' ? 10 : 0 }}>
                            <User size={28} color={color} strokeWidth={focused ? 3 : 2} />
                        </View>
                    ),
                }}
            />
        </Tabs>
    );
}
