import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { Button } from '../../components/ui/button';
import { useColor } from '../../hooks/useColor';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Calendar, DollarSign, Clock, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { useToast } from '../../providers/toast-context';
import { useSession } from '../../providers/auth-context';

export default function RequestDetails() {
    const { id, type } = useLocalSearchParams<{ id: string; type: 'timeoff' | 'expense' }>();
    const router = useRouter();
    const toast = useToast();
    const { user } = useSession();
    const [loading, setLoading] = useState(true);
    const [request, setRequest] = useState<any>(null);

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const pastelPurple = useColor('pastelPurple' as any);
    const pastelBlue = useColor('pastelBlue' as any);
    const primary = useColor('primary');

    useEffect(() => {
        if (user) {
            fetchRequestDetails();
        }
    }, [id, type, user]);

    const fetchRequestDetails = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            if (type === 'timeoff') {
                const data = await apiClient.getTimeOffRequests(user.id);
                // Handle various potential response structures
                const list = data.leaves || data.requests || (Array.isArray(data) ? data : []);
                const found = list.find((r: any) => r.id === parseInt(id));
                setRequest(found);
            } else {
                const data = await apiClient.getExpenses(user.id);
                // Handle various potential response structures
                const list = data.expenses || data.requests || (Array.isArray(data) ? data : []);
                const found = list.find((r: any) => r.id === parseInt(id));
                setRequest(found);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load request details');
        } finally {
            setLoading(false);
        }
    };

    const getStatusConfig = (status: string) => {
        const statusLower = status?.toLowerCase() || '';
        if (['validate', 'approve', 'approved', 'done', 'posted'].some(s => statusLower.includes(s))) {
            return { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle, label: 'Approved' };
        } else if (['refuse', 'reject', 'cancel'].some(s => statusLower.includes(s))) {
            return { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', icon: XCircle, label: 'Rejected' };
        } else {
            return { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', icon: AlertCircle, label: 'Pending' };
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={primary} />
            </View>
        );
    }

    if (!request) {
        return (
            <View style={{ flex: 1, backgroundColor: background, padding: 24, paddingTop: 60 }}>
                <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                    <ChevronLeft size={24} color={text} />
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: text, marginLeft: 4 }}>Back</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <AlertCircle size={48} color={text} />
                    <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 20, color: text, marginTop: 16 }}>Request Not Found</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted, marginTop: 8 }}>This item may have been deleted.</Text>
                </View>
            </View>
        );
    }

    const statusConfig = getStatusConfig(request.state);
    const StatusIcon = statusConfig.icon;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ padding: 24, paddingBottom: 180 }}>
            {/* Header */}
            <View style={{ marginBottom: 32, flexDirection: 'row', alignItems: 'center', marginTop: 20 }}>
                <TouchableOpacity onPress={() => router.push('/(app)/dashboard')} style={{
                    width: 40, height: 40, borderRadius: 20, backgroundColor: cardColor, alignItems: 'center', justifyContent: 'center',
                    shadowColor: "#c9c9c9ff", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginRight: 16
                }}>
                    <ChevronLeft size={24} color={text} />
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: text }}>Request Details</Text>
            </View>

            {/* Status Badge */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                backgroundColor: statusConfig.bgColor,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 99,
                marginBottom: 24,
                gap: 8,
                borderWidth: 1,
                borderColor: statusConfig.color + '30' // 30 opacity
            }}>
                <StatusIcon size={18} color={statusConfig.color} strokeWidth={2.5} />
                <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: statusConfig.color }}>{statusConfig.label}</Text>
            </View>

            {/* Main Info Card */}
            <View style={{
                backgroundColor: type === 'timeoff' ? pastelPurple : pastelBlue,
                borderRadius: 32,
                padding: 32,
                marginBottom: 24,
                shadowColor: type === 'timeoff' ? pastelPurple : pastelBlue,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.2,
                shadowRadius: 24,
                elevation: 8,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
                    <View style={{
                        width: 64,
                        height: 64,
                        borderRadius: 24,
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.1)'
                    }}>
                        {type === 'timeoff' ? (
                            <Calendar size={32} color="#ffffffff" strokeWidth={1.5} />
                        ) : (
                            <DollarSign size={32} color="#ffffffff" strokeWidth={1.5} />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#ffffffff', opacity: 0.6, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {type === 'timeoff' ? 'Time Off Request' : 'Expense Claim'}
                        </Text>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: '#ffffffff', lineHeight: 34 }}>
                            {type === 'timeoff' ? request.holiday_status_id?.[1] || 'Leave' : request.name}
                        </Text>
                    </View>
                </View>

                {type === 'expense' && (
                    <View style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 20 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#ffffffff', opacity: 0.7, marginBottom: 2 }}>Total Amount</Text>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 42, color: '#ffffffff' }}>
                            ${request.total_amount || request.unit_amount || '0.00'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Details Section */}
            <View style={{
                backgroundColor: cardColor,
                borderRadius: 24,
                padding: 24,
                gap: 24,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.03,
                shadowRadius: 12,
                elevation: 2,
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.03)'
            }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: text }}>Details</Text>

                {type === 'timeoff' ? (
                    <>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calendar size={16} color={text} />
                                </View>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 18, color: text }}>
                                    {request.request_date_from} <Text style={{ color: muted }}>→</Text> {request.request_date_to}
                                </Text>
                            </View>
                        </View>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Days</Text>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 24, color: text }}>
                                {request.number_of_days || 'N/A'} <Text style={{ fontSize: 16, fontFamily: 'DMSans_400Regular', color: muted }}>days</Text>
                            </Text>
                        </View>
                        {request.name && (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reason</Text>
                                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: text, lineHeight: 24 }}>{request.name}</Text>
                            </View>
                        )}
                    </>
                ) : (
                    <>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</Text>
                            <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: text }}>{request.name}</Text>
                        </View>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calendar size={16} color={text} />
                                </View>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 18, color: text }}>
                                    {request.date || 'N/A'}
                                </Text>
                            </View>
                        </View>
                        {request.product_id && (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                                        <DollarSign size={16} color={text} />
                                    </View>
                                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>
                                        {request.product_id[1]}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 8 }} />

                {request.employee_id && (
                    <View style={{ gap: 8 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Submitted By</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={20} color="#4338ca" />
                            </View>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: text }}>
                                {request.employee_id[1] || 'You'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}
