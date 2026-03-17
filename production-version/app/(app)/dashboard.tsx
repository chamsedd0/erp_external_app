import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Animated, RefreshControl } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { Plus, Clock, Calendar, DollarSign, Timer, Wrench, Monitor } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiClient } from '../../api/client';
import { useSession } from '../../providers/auth-context';

export default function Dashboard() {
    const router = useRouter();
    const { user } = useSession();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Per-type counts
    const [pendingLeaves, setPendingLeaves] = useState(0);
    const [pendingExpenses, setPendingExpenses] = useState(0);
    const [timesheetCount, setTimesheetCount] = useState(0);
    const [helpdeskCount, setHelpdeskCount] = useState(0);
    const [maintenanceCount, setMaintenanceCount] = useState(0);

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
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();
    }, []);

    useEffect(() => {
        if (!loading) {
            Animated.stagger(100, [
                Animated.spring(card1Anim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
                Animated.spring(card2Anim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
                Animated.spring(card3Anim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
                Animated.spring(card4Anim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
            ]).start();
        }
    }, [loading]);

    const fetchDashboardData = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [leavesResult, expensesResult, timesheetResult, helpdeskResult, maintenanceResult] =
                await Promise.allSettled([
                    apiClient.getTimeOffRequests(user.id),
                    apiClient.getExpenses(user.id),
                    apiClient.getTimesheetEntries(user.id),
                    apiClient.getHelpdeskTickets(user.id),
                    apiClient.getMaintenanceRequests(user.id),
                ]);

            const leaves = leavesResult.status === 'fulfilled' ? (leavesResult.value.leaves || []) : [];
            const expenses = expensesResult.status === 'fulfilled' ? (expensesResult.value.expenses || []) : [];
            const timesheets = timesheetResult.status === 'fulfilled' ? (timesheetResult.value.entries || []) : [];
            const tickets = helpdeskResult.status === 'fulfilled' && helpdeskResult.value?.available !== false
                ? (helpdeskResult.value.tickets || []) : [];
            const maintenance = maintenanceResult.status === 'fulfilled' ? (maintenanceResult.value.requests || []) : [];

            const pl = leaves.filter((l: any) => ['confirm', 'validate1', 'draft'].includes(l.state)).length;
            const pe = expenses.filter((e: any) => ['draft', 'reported'].includes(e.state)).length;
            const openTickets = tickets.filter((t: any) => {
                const stageName = Array.isArray(t.stage_id) ? (t.stage_id[1] as string) : '';
                return !(/\b(done|closed|resolved|cancel)/i.test(stageName));
            }).length;
            const openMaintenance = maintenance.filter((m: any) => {
                const stageName = Array.isArray(m.stage_id) ? (m.stage_id[1] as string) : '';
                return !(/\b(done|repaired|closed|cancel)/i.test(stageName));
            }).length;

            setPendingLeaves(pl);
            setPendingExpenses(pe);
            setTimesheetCount(timesheets.length);
            setHelpdeskCount(openTickets);
            setMaintenanceCount(openMaintenance);

            const formattedLeaves = leaves.map((l: any) => ({
                id: l.id, type: 'timeoff',
                title: l.name || 'Time Off Request',
                date: l.date_from, status: l.state, amount: null,
            }));
            const formattedExpenses = expenses.map((e: any) => ({
                id: e.id, type: 'expense',
                title: e.name || 'Expense',
                date: e.date, status: e.state,
                amount: e.total_amount || (e.unit_amount || 0) * (e.quantity || 1),
            }));
            const formattedTimesheets = timesheets.map((t: any) => ({
                id: t.id, type: 'timesheet',
                title: Array.isArray(t.project_id) ? t.project_id[1] : 'Timesheet Entry',
                date: t.date, status: 'logged',
                amount: t.unit_amount ? `${t.unit_amount.toFixed(1)}h` : null,
            }));
            const formattedTickets = tickets.map((t: any) => ({
                id: t.id, type: 'helpdesk',
                title: t.name || 'IT Support Ticket',
                date: t.create_date,
                status: Array.isArray(t.stage_id) ? t.stage_id[1] : 'submitted',
                amount: null,
            }));
            const formattedMaintenance = maintenance.map((m: any) => ({
                id: m.id, type: 'maintenance',
                title: m.name || 'Maintenance Request',
                date: m.create_date,
                status: Array.isArray(m.stage_id) ? m.stage_id[1] : 'submitted',
                amount: null,
            }));

            const all = [
                ...formattedLeaves, ...formattedExpenses, ...formattedTimesheets,
                ...formattedTickets, ...formattedMaintenance,
            ]
                .filter(a => a.date)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 6);

            setRecentActivities(all);
        } catch (error) {
            console.error('Dashboard fetch error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => { setRefreshing(true); fetchDashboardData(); };

    const firstName = user?.name ? user.name.split(' ')[0] : 'User';
    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
    const totalPending = pendingLeaves + pendingExpenses;

    function activityColor(type: string) {
        if (type === 'timeoff') return semanticInfo;
        if (type === 'expense' || type === 'timesheet') return semanticSuccess;
        if (type === 'helpdesk') return semanticWarning;
        if (type === 'maintenance') return semanticError;
        return muted;
    }

    function activityIcon(type: string, size = 24) {
        const color = activityColor(type);
        const props = { size, strokeWidth: 2.5, color };
        if (type === 'timeoff') return <Calendar {...props} />;
        if (type === 'expense') return <DollarSign {...props} />;
        if (type === 'timesheet') return <Timer {...props} />;
        if (type === 'helpdesk') return <Monitor {...props} />;
        if (type === 'maintenance') return <Wrench {...props} />;
        return <Clock {...props} />;
    }

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header */}
            <Animated.View style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: 32, marginTop: 20,
                opacity: fadeAnim, transform: [{ translateY: slideAnim }],
            }}>
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
                        backgroundColor: primary, width: 52, height: 52, borderRadius: 26,
                        alignItems: 'center', justifyContent: 'center',
                        shadowColor: primary, shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
                    }}
                >
                    <Plus size={24} color={primaryForeground} strokeWidth={3} />
                </TouchableOpacity>
            </Animated.View>

            <View style={{ gap: 16 }}>
                {/* Pending Requests Card */}
                <Animated.View style={{
                    opacity: card1Anim,
                    transform: [{ translateY: card1Anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
                }}>
                    <TouchableOpacity
                        onPress={() => router.push('/(app)/search?status=pending')}
                        activeOpacity={0.9}
                        style={{
                            backgroundColor: semanticWarning + '18', borderRadius: 32, padding: 24,
                            justifyContent: 'space-between', overflow: 'hidden',
                        }}
                    >
                        <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.07, transform: [{ rotate: '15deg' }] }}>
                            <Clock size={160} color={semanticWarning} />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <View style={{ backgroundColor: semanticWarning + '30', padding: 10, borderRadius: 14 }}>
                                <Clock size={20} color={semanticWarning} strokeWidth={2.5} />
                            </View>
                            <View style={{ backgroundColor: semanticWarning + '30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 12, color: semanticWarning }}>Priority</Text>
                            </View>
                        </View>

                        <Text style={{ fontSize: 15, color: semanticWarning, opacity: 0.9, marginBottom: 4, fontFamily: 'DMSans_500Medium' }}>Pending Approval</Text>
                        <Text style={{ fontSize: 42, fontFamily: 'Outfit_700Bold', letterSpacing: -1, color: text, marginBottom: 16 }}>
                            {loading ? '...' : `${totalPending} Waiting`}
                        </Text>

                        {!loading && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {[
                                    { label: 'Leave', count: pendingLeaves, color: semanticInfo },
                                    { label: 'Expense', count: pendingExpenses, color: semanticSuccess },
                                    { label: 'IT', count: helpdeskCount, color: semanticWarning },
                                    { label: 'Maintenance', count: maintenanceCount, color: semanticError },
                                ].map(item => (
                                    <View key={item.label} style={{
                                        flexDirection: 'row', alignItems: 'center', gap: 4,
                                        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
                                        backgroundColor: item.color + '28',
                                    }}>
                                        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 12, color: item.color }}>{item.count}</Text>
                                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: item.color }}>{item.label}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* Quick Actions Card */}
                <Animated.View style={{
                    opacity: card2Anim,
                    transform: [{ translateY: card2Anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
                }}>
                    <View style={{
                        backgroundColor: semanticInfo + '18', borderRadius: 32, padding: 24,
                        justifyContent: 'space-between',
                    }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <View style={{ backgroundColor: semanticInfo + '30', padding: 10, borderRadius: 14 }}>
                                <Plus size={20} color={semanticInfo} strokeWidth={2.5} />
                            </View>
                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: semanticInfo, opacity: 0.9 }}>Quick Actions</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }} onPress={() => router.push('/(app)/new-request')}>
                                <View style={{ width: 52, height: 52, borderRadius: 20, backgroundColor: semanticInfo + '28', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calendar size={22} color={semanticInfo} />
                                </View>
                                <Text style={{ fontSize: 12, fontFamily: 'DMSans_500Medium', color: text }}>Time Off</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }} onPress={() => router.push('/(app)/new-request')}>
                                <View style={{ width: 52, height: 52, borderRadius: 20, backgroundColor: semanticInfo + '28', alignItems: 'center', justifyContent: 'center' }}>
                                    <DollarSign size={22} color={semanticInfo} />
                                </View>
                                <Text style={{ fontSize: 12, fontFamily: 'DMSans_500Medium', color: text }}>Expense</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }} onPress={() => router.push('/(app)/timesheet')}>
                                <View style={{ width: 52, height: 52, borderRadius: 20, backgroundColor: semanticInfo + '28', alignItems: 'center', justifyContent: 'center' }}>
                                    <Timer size={22} color={semanticInfo} />
                                </View>
                                <Text style={{ fontSize: 12, fontFamily: 'DMSans_500Medium', color: text }}>Timesheet</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ alignItems: 'center', gap: 8 }} onPress={() => router.push('/(app)/new-request')}>
                                <View style={{ width: 52, height: 52, borderRadius: 20, backgroundColor: semanticInfo + '28', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontFamily: 'Outfit_700Bold', color: semanticInfo }}>...</Text>
                                </View>
                                <Text style={{ fontSize: 12, fontFamily: 'DMSans_500Medium', color: text }}>More</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>

                {/* Stats row */}
                <View style={{ flexDirection: 'row', gap: 16 }}>
                    <Animated.View style={{
                        flex: 1, opacity: card3Anim,
                        transform: [{ translateY: card3Anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
                    }}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => router.push('/(app)/timesheet')}
                            style={{
                                backgroundColor: semanticSuccess + '18', borderRadius: 32, padding: 24,
                                height: 180, justifyContent: 'space-between',
                            }}
                        >
                            <View style={{ backgroundColor: semanticSuccess + '30', padding: 10, borderRadius: 14, alignSelf: 'flex-start' }}>
                                <Timer size={20} color={semanticSuccess} strokeWidth={2.5} />
                            </View>
                            <View>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: semanticSuccess, opacity: 0.9, marginBottom: 2 }}>Timesheet</Text>
                                <Text style={{ fontSize: 22, fontFamily: 'Outfit_700Bold', color: text }}>
                                    {loading ? '...' : `${timesheetCount} Entries`}
                                </Text>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: text, opacity: 0.5, marginTop: 4 }}>Tap to log hours</Text>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View style={{
                        flex: 1, opacity: card4Anim,
                        transform: [{ translateY: card4Anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
                    }}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => router.push('/(app)/notifications')}
                            style={{
                                backgroundColor: semanticWarning + '18', borderRadius: 32, padding: 24,
                                height: 180, justifyContent: 'space-between',
                            }}
                        >
                            <View style={{ backgroundColor: semanticWarning + '30', padding: 10, borderRadius: 14, alignSelf: 'flex-start' }}>
                                <Monitor size={20} color={semanticWarning} strokeWidth={2.5} />
                            </View>
                            <View>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: semanticWarning, opacity: 0.9, marginBottom: 2 }}>IT + Maintenance</Text>
                                <Text style={{ fontSize: 22, fontFamily: 'Outfit_700Bold', color: text }}>
                                    {loading ? '...' : `${helpdeskCount + maintenanceCount} Open`}
                                </Text>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: text, opacity: 0.5, marginTop: 4 }}>Active requests</Text>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                {/* Recent Activities */}
                <Animated.View style={{
                    marginTop: 24, opacity: card4Anim,
                    transform: [{ translateY: card4Anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
                }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: text }}>Recent Activities</Text>
                        <TouchableOpacity onPress={() => router.push('/(app)/notifications')}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', color: primary, fontSize: 14 }}>View All</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ gap: 12 }}>
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
                                        params: { id: activity.id.toString(), type: activity.type },
                                    })}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', padding: 16,
                                        backgroundColor: cardColor, borderRadius: 24,
                                        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
                                    }}
                                >
                                    <View style={{
                                        width: 48, height: 48, borderRadius: 18,
                                        backgroundColor: activityColor(activity.type) + '20',
                                        alignItems: 'center', justifyContent: 'center', marginRight: 14,
                                    }}>
                                        {activityIcon(activity.type, 22)}
                                    </View>

                                    <View style={{ flex: 1, gap: 3 }}>
                                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: text }}>
                                            {activity.title}
                                        </Text>
                                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted }}>
                                            {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </Text>
                                    </View>

                                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                        {activity.amount !== null && (
                                            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 15, color: text }}>
                                                {typeof activity.amount === 'string' ? activity.amount : `$${activity.amount}`}
                                            </Text>
                                        )}
                                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: activityColor(activity.type) + '20' }}>
                                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 11, color: activityColor(activity.type), textTransform: 'uppercase' }}>
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
