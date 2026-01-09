import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Animated, RefreshControl } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { Plus, Clock, Calendar, DollarSign, FileText } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiClient } from '../../api/client';
import { useSession } from '../../providers/auth-context';

export default function Dashboard() {
    const router = useRouter();
    const { user } = useSession();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [recentActivities, setRecentActivities] = useState<any[]>([]);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const card1Anim = useRef(new Animated.Value(0)).current;
    const card2Anim = useRef(new Animated.Value(0)).current;
    const card3Anim = useRef(new Animated.Value(0)).current;
    const card4Anim = useRef(new Animated.Value(0)).current;

    const background = useColor('background');
    const text = useColor('text');
    const primary = useColor('primary');
    const primaryForeground = useColor('primaryForeground');

    // Pastel colors
    const pastelPurple = useColor('pastelPurple' as any);
    const pastelBlue = useColor('pastelBlue' as any);
    const pastelPink = useColor('pastelPink' as any);
    const pastelGreen = useColor('pastelGreen' as any);

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [])
    );

    useEffect(() => {
        // Initial fade in for header
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    useEffect(() => {
        if (!loading) {
            // Staggered animation for cards
            Animated.stagger(100, [
                Animated.spring(card1Anim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.spring(card2Anim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.spring(card3Anim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.spring(card4Anim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [loading]);

    const fetchDashboardData = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [leavesData, expensesData] = await Promise.all([
                apiClient.getTimeOffRequests(user.id),
                apiClient.getExpenses(user.id)
            ]);

            const leaves = leavesData.leaves || [];
            const expenses = expensesData.expenses || [];

            // Count pending
            const pendingLeaves = leaves.filter((l: any) => ['confirm', 'validate1', 'draft'].includes(l.state)).length;
            const pendingExpenses = expenses.filter((e: any) => ['draft', 'reported'].includes(e.state)).length;

            setPendingCount(pendingLeaves + pendingExpenses);

            // Process Recent Activities
            const formattedLeaves = leaves.map((l: any) => ({
                id: l.id,
                type: 'time_off',
                title: l.name || 'Time Off Request',
                date: l.date_from, // Using start date
                status: l.state, // You might want to map this to a prettier label
                amount: null
            }));

            const formattedExpenses = expenses.map((e: any) => ({
                id: e.id,
                type: 'expense',
                title: e.name || 'Expense',
                date: e.date,
                status: e.state,
                amount: e.total_amount || (e.unit_amount || 0) * (e.quantity || 1)
            }));

            const combinedActivities = [...formattedLeaves, ...formattedExpenses]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5);

            setRecentActivities(combinedActivities);

        } catch (error) {
            console.error('Dashboard fetch error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const firstName = user?.name ? user.name.split(' ')[0] : 'User';

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header Section - Animated */}
            <Animated.View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 24,
                    marginTop: 10,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                }}
            >
                <View>
                    <Text style={{ fontSize: 42, fontFamily: 'Outfit_700Bold', letterSpacing: -1, lineHeight: 48, color: text }}>
                        Welcome
                    </Text>
                    <Text style={{ fontSize: 42, fontFamily: 'Outfit_700Bold', letterSpacing: -1, lineHeight: 48, color: text }}>
                        back, {firstName}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => router.push('/(app)/new-request')}
                    style={{ backgroundColor: primary, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                    <Plus size={16} color={primaryForeground} strokeWidth={4} />
                </TouchableOpacity>
            </Animated.View>

            {/* Main Cards Feed */}
            <View style={{ gap: 16 }}>
                {/* Pending Requests - Purple - Animated */}
                <Animated.View
                    style={{
                        opacity: card1Anim,
                        transform: [{
                            translateY: card1Anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                            }),
                        }],
                    }}
                >
                    <TouchableOpacity
                        onPress={() => router.push('/(app)/search?status=pending')}
                        style={{ backgroundColor: pastelPurple, borderRadius: 32, padding: 24, height: 160, justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.4)', padding: 8, borderRadius: 99 }}>
                                <Clock size={20} color={text} />
                            </View>
                            <Text style={{ fontFamily: 'DMSans_700Bold', opacity: 0.6 }}>Pending Requests</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <View>
                                <Text style={{ fontSize: 14, opacity: 0.6, marginBottom: 4, fontFamily: 'DMSans_500Medium' }}>Action Required</Text>
                                <Text style={{ fontSize: 32, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5, color: text }}>
                                    {loading ? '...' : `${pendingCount} Waiting`}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                                    {[1, 2, 3].map(i => (
                                        <View key={i} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.5)', marginLeft: -8, borderWidth: 2, borderColor: pastelPurple }} />
                                    ))}
                                </View>
                                <Text style={{ fontSize: 13, fontFamily: 'DMSans_700Bold', color: text, opacity: 0.7 }}>On hold</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </Animated.View>

                {/* Quick Links - Blue - Animated */}
                <Animated.View
                    style={{
                        opacity: card2Anim,
                        transform: [{
                            translateY: card2Anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                            }),
                        }],
                    }}
                >
                    <View style={{ backgroundColor: pastelBlue, borderRadius: 32, padding: 24, height: 180, justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.4)', padding: 8, borderRadius: 99 }}>
                                <Plus size={20} color={text} />
                            </View>
                            <Text style={{ fontWeight: '600', opacity: 0.6 }}>Quick Links</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }} onPress={() => router.push('/(app)/new-request')}>
                                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calendar size={24} color='white' />
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>Time Off</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }} onPress={() => router.push('/(app)/new-request')}>
                                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                                    <DollarSign size={24} color='white' />
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>Expense</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={24} color='white' />
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>Payslip</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontWeight: 'bold' }}>...</Text>
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>More</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                    {/* Payslips Card - Pink - Half Width - Animated */}
                    <Animated.View
                        style={{
                            flex: 1,
                            opacity: card3Anim,
                            transform: [{
                                translateY: card3Anim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [50, 0],
                                }),
                            }],
                        }}
                    >
                        <TouchableOpacity style={{ backgroundColor: pastelPink, borderRadius: 32, padding: 24, height: 180, justifyContent: 'space-between' }}>
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: 8, borderRadius: 99, alignSelf: 'flex-start' }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: text }} />
                            </View>

                            <View>
                                <Text style={{ fontSize: 14, opacity: 0.6, marginBottom: 2 }}>Latest</Text>
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: text }}>July Pay</Text>
                                <Text style={{ fontSize: 14, opacity: 0.6, marginTop: 4 }}>Available Now</Text>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Team Card - Green - Half Width - Animated */}
                    <Animated.View
                        style={{
                            flex: 1,
                            opacity: card4Anim,
                            transform: [{
                                translateY: card4Anim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [50, 0],
                                }),
                            }],
                        }}
                    >
                        <TouchableOpacity style={{ backgroundColor: pastelGreen, borderRadius: 32, padding: 24, height: 180, justifyContent: 'space-between' }}>
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: 8, borderRadius: 99, alignSelf: 'flex-start' }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: text }} />
                            </View>

                            <View>
                                <Text style={{ fontSize: 14, opacity: 0.6, marginBottom: 2 }}>Notifications</Text>
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: text }}>3 New</Text>
                                <Text style={{ fontSize: 14, opacity: 0.6, marginTop: 4 }}>Alerts</Text>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                {/* Recent Activities Section - Animated */}
                <Animated.View
                    style={{
                        marginTop: 24,
                        opacity: card4Anim, // Reusing card4Anim for now as it's the last one
                        transform: [{
                            translateY: card4Anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                            }),
                        }],
                    }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: text }}>Recent Activities</Text>
                        <TouchableOpacity onPress={() => router.push('/(app)/notifications')}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', color: primary, fontSize: 14 }}>View All</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ gap: 12 }}>
                        {recentActivities.length === 0 ? (
                            <View style={{ padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 24 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', color: text, opacity: 0.5 }}>No recent activities</Text>
                            </View>
                        ) : (
                            recentActivities.map((activity, index) => (
                                <TouchableOpacity
                                    key={`${activity.type}-${activity.id}-${index}`}
                                    onPress={() => router.push({
                                        pathname: '/(app)/request-details',
                                        params: { id: activity.id.toString(), type: activity.type }
                                    })}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: 16,
                                        backgroundColor: background,
                                        borderRadius: 20,
                                        borderWidth: 1,
                                        borderColor: 'rgba(0,0,0,0.05)',
                                        // Shadow
                                        shadowColor: "#000",
                                        shadowOffset: {
                                            width: 0,
                                            height: 2,
                                        },
                                        shadowOpacity: 0.03,
                                        shadowRadius: 8,
                                        elevation: 2,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 16,
                                            backgroundColor: activity.type === 'time_off' ? `${pastelBlue}20` : `${pastelGreen}20`, // 20% opacity hex
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 16
                                        }}
                                    >
                                        {activity.type === 'time_off' ? (
                                            <Calendar size={22} color={pastelBlue} strokeWidth={2.5} />
                                        ) : (
                                            <DollarSign size={22} color={pastelGreen} strokeWidth={2.5} />
                                        )}
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 16, color: text, marginBottom: 2 }}>
                                            {activity.title}
                                        </Text>
                                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: text, opacity: 0.5 }}>
                                            {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {activity.status}
                                        </Text>
                                    </View>

                                    {activity.amount !== null && (
                                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: text }}>
                                            ${activity.amount}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </Animated.View>
            </View>
        </ScrollView>
    );
}

