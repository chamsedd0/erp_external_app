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
    const muted = useColor('textMuted');
    const cardColor = useColor('card');

    // Semantic colors
    const semanticSuccess = useColor('semanticSuccess' as any);
    const semanticWarning = useColor('semanticWarning' as any);
    const semanticError = useColor('semanticError' as any);
    const semanticInfo = useColor('semanticInfo' as any);

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
    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header Section - Animated */}
            {/* Header Section - Animated */}
            <Animated.View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 32,
                    marginTop: 20,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                }}
            >
                <View>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: primary, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        {currentDate}
                    </Text>
                    <Text style={{ fontSize: 36, fontFamily: 'Outfit_700Bold', letterSpacing: -1, lineHeight: 42, color: text }}>
                        Welcome back,{'\n'}{firstName}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => router.push('/(app)/new-request')}
                    activeOpacity={0.8}
                    style={{
                        backgroundColor: primary,
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: primary,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                        elevation: 8
                    }}
                >
                    <Plus size={24} color={primaryForeground} strokeWidth={3} />
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
                        activeOpacity={0.9}
                        style={{
                            backgroundColor: 'transparent',
                            borderRadius: 32,
                            padding: 24,
                            height: 180,
                            justifyContent: 'space-between',
                            overflow: 'hidden',
                            borderColor: semanticWarning,
                            borderWidth: 1,

                        }}>

                        {/* Watermark Icon */}
                        <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.05, transform: [{ rotate: '15deg' }] }}>
                            <Clock size={160} color={semanticWarning} />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ backgroundColor: 'transparent', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: semanticWarning }}>
                                <Clock size={20} color={semanticWarning} strokeWidth={2.5} />
                            </View>
                            <View style={{ backgroundColor: 'transparent', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: semanticWarning }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 12, color: semanticWarning }}>Priority</Text>
                            </View>
                        </View>

                        <View>
                            <Text style={{ fontSize: 15, color: semanticWarning, opacity: 0.9, marginBottom: 4, fontFamily: 'DMSans_500Medium' }}>Pending Requests</Text>
                            <Text style={{ fontSize: 42, fontFamily: 'Outfit_700Bold', letterSpacing: -1, color: text }}>
                                {loading ? '...' : `${pendingCount} Waiting`}
                            </Text>
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
                    <View style={{
                        backgroundColor: 'transparent',
                        borderRadius: 32,
                        padding: 24,
                        height: 180,
                        justifyContent: 'space-between',
                        borderColor: semanticInfo,
                        borderWidth: 1,

                    }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <View style={{ backgroundColor: 'transparent', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: semanticInfo }}>
                                <Plus size={20} color={semanticInfo} strokeWidth={2.5} />
                            </View>
                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: semanticInfo, opacity: 0.9 }}>Quick Actions</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }} onPress={() => router.push('/(app)/new-request')}>
                                <View style={{ width: 52, height: 52, borderRadius: 20, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticInfo }}>
                                    <Calendar size={22} color={semanticInfo} />
                                </View>
                                <Text style={{ fontSize: 12, fontFamily: 'DMSans_500Medium', color: text }}>Time Off</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }} onPress={() => router.push('/(app)/new-request')}>
                                <View style={{ width: 52, height: 52, borderRadius: 20, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticInfo }}>
                                    <DollarSign size={22} color={semanticInfo} />
                                </View>
                                <Text style={{ fontSize: 12, fontFamily: 'DMSans_500Medium', color: text }}>Expense</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 52, height: 52, borderRadius: 20, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticInfo }}>
                                    <FileText size={22} color={semanticInfo} />
                                </View>
                                <Text style={{ fontSize: 12, fontFamily: 'DMSans_500Medium', color: text }}>Payslip</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 52, height: 52, borderRadius: 20, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticInfo }}>
                                    <Text style={{ fontFamily: 'Outfit_700Bold', color: semanticInfo }}>...</Text>
                                </View>
                                <Text style={{ fontSize: 12, fontFamily: 'DMSans_500Medium', color: text }}>More</Text>
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
                        <TouchableOpacity
                            activeOpacity={0.9}
                            style={{
                                backgroundColor: 'transparent',
                                borderRadius: 32,
                                padding: 24,
                                height: 180,
                                justifyContent: 'space-between',
                                borderColor: semanticSuccess,
                                borderWidth: 1,
                            }}>
                            <View style={{ backgroundColor: 'transparent', padding: 10, borderRadius: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: semanticSuccess }}>
                                <FileText size={20} color={semanticSuccess} strokeWidth={2.5} />
                            </View>

                            <View>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: semanticSuccess, opacity: 0.9, marginBottom: 2 }}>Latest Slip</Text>
                                <Text style={{ fontSize: 22, fontFamily: 'Outfit_700Bold', color: text }}>July Pay</Text>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: text, opacity: 0.5, marginTop: 4 }}>Available Now</Text>
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
                        <TouchableOpacity
                            activeOpacity={0.9}
                            style={{
                                backgroundColor: 'transparent',
                                borderRadius: 32,
                                padding: 24,
                                height: 180,
                                justifyContent: 'space-between',
                                borderColor: semanticInfo,
                                borderWidth: 1,
                            }}>
                            <View style={{ backgroundColor: 'transparent', padding: 10, borderRadius: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: semanticInfo }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: semanticInfo }} />
                                <View style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: semanticInfo, marginRight: 2 }} />
                                </View>
                            </View>

                            <View>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: semanticInfo, opacity: 0.9, marginBottom: 2 }}>Notifications</Text>
                                <Text style={{ fontSize: 22, fontFamily: 'Outfit_700Bold', color: text }}>3 New</Text>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: text, opacity: 0.5, marginTop: 4 }}>Alerts</Text>
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

                    <View style={{ gap: 16 }}>
                        {recentActivities.length === 0 ? (
                            <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: cardColor, borderRadius: 24 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', color: muted, fontSize: 16 }}>No recent activities</Text>
                            </View>
                        ) : (
                            recentActivities.map((activity, index) => (
                                <TouchableOpacity
                                    key={`${activity.type}-${activity.id}-${index}`}
                                    activeOpacity={0.7}
                                    onPress={() => router.push({
                                        pathname: '/(app)/request-details',
                                        params: { id: activity.id.toString(), type: activity.type }
                                    })}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: 20,
                                        backgroundColor: cardColor,
                                        borderRadius: 24,
                                        // Shadow
                                        shadowColor: "#000",
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 12,
                                        elevation: 3,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 52,
                                            height: 52,
                                            borderRadius: 20,
                                            backgroundColor: 'transparent',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 16,
                                            borderWidth: 1,
                                            borderColor: activity.type === 'time_off' ? semanticInfo : semanticSuccess,
                                        }}
                                    >
                                        {activity.type === 'time_off' ? (
                                            <Calendar size={24} color={semanticInfo} strokeWidth={2.5} />
                                        ) : (
                                            <DollarSign size={24} color={semanticSuccess} strokeWidth={2.5} />
                                        )}
                                    </View>

                                    <View style={{ flex: 1, gap: 4 }}>
                                        <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 17, color: text }}>
                                            {activity.title}
                                        </Text>
                                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted }}>
                                            {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </Text>
                                    </View>

                                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                        {activity.amount !== null && (
                                            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: text }}>
                                                ${activity.amount}
                                            </Text>
                                        )}
                                        <View style={{
                                            paddingHorizontal: 10,
                                            paddingVertical: 4,
                                            borderRadius: 8,
                                            backgroundColor: 'rgba(0,0,0,0.05)'
                                        }}>
                                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 11, color: muted, textTransform: 'uppercase' }}>
                                                {activity.status}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </Animated.View>
            </View>
        </ScrollView>
    );
}

