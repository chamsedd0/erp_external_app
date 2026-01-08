import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { Button } from '../../components/ui/button';
import { useColor } from '../../hooks/useColor';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Calendar, DollarSign, Clock, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { useToast } from '../../providers/toast-context';

export default function RequestDetails() {
    const { id, type } = useLocalSearchParams<{ id: string; type: 'timeoff' | 'expense' }>();
    const router = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [request, setRequest] = useState<any>(null);

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const pastelPurple = useColor('pastelPurple' as any);
    const pastelBlue = useColor('pastelBlue' as any);

    useEffect(() => {
        fetchRequestDetails();
    }, [id, type]);

    const fetchRequestDetails = async () => {
        setLoading(true);
        try {
            // For now, we'll use the existing endpoints and filter
            if (type === 'timeoff') {
                const data = await apiClient.getPendingTimeOff();
                const found = data.requests?.find((r: any) => r.id === parseInt(id));
                setRequest(found);
            } else {
                const data = await apiClient.getPendingExpenses();
                const found = data.requests?.find((r: any) => r.id === parseInt(id));
                setRequest(found);
            }
        } catch (error) {
            toast.error('Failed to load request details');
        } finally {
            setLoading(false);
        }
    };

    const getStatusConfig = (status: string) => {
        const statusLower = status?.toLowerCase() || '';
        if (statusLower.includes('approve') || statusLower.includes('validate')) {
            return { color: '#10b981', bgColor: '#d1fae5', icon: CheckCircle, label: 'Approved' };
        } else if (statusLower.includes('refuse') || statusLower.includes('reject')) {
            return { color: '#ef4444', bgColor: '#fee2e2', icon: XCircle, label: 'Rejected' };
        } else {
            return { color: '#f59e0b', bgColor: '#fef3c7', icon: AlertCircle, label: 'Pending' };
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!request) {
        return (
            <View style={{ flex: 1, backgroundColor: background, padding: 24 }}>
                <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                    <ChevronLeft size={24} color={text} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginLeft: 4 }}>Back</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18, color: muted }}>Request not found</Text>
                </View>
            </View>
        );
    }

    const statusConfig = getStatusConfig(request.state);
    const StatusIcon = statusConfig.icon;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
            {/* Header */}
            <View style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ChevronLeft size={24} color={text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: text }}>Request Details</Text>
            </View>

            {/* Status Badge */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                backgroundColor: statusConfig.bgColor,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                marginBottom: 24,
                gap: 8,
            }}>
                <StatusIcon size={18} color={statusConfig.color} strokeWidth={2.5} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: statusConfig.color }}>{statusConfig.label}</Text>
            </View>

            {/* Main Info Card */}
            <View style={{
                backgroundColor: type === 'timeoff' ? pastelPurple : pastelBlue,
                borderRadius: 24,
                padding: 24,
                marginBottom: 24,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 4,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <View style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        {type === 'timeoff' ? (
                            <Clock size={28} color="#1a1a1a" />
                        ) : (
                            <DollarSign size={28} color="#1a1a1a" />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: '#1a1a1a', opacity: 0.7, marginBottom: 4 }}>
                            {type === 'timeoff' ? 'Time Off Request' : 'Expense Claim'}
                        </Text>
                        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' }}>
                            {type === 'timeoff' ? request.holiday_status_id?.[1] || 'Leave' : request.name}
                        </Text>
                    </View>
                </View>

                {type === 'expense' && (
                    <View style={{ marginTop: 8 }}>
                        <Text style={{ fontSize: 42, fontWeight: 'bold', color: '#1a1a1a' }}>
                            ${request.total_amount || request.unit_amount || '0.00'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Details Section */}
            <View style={{
                backgroundColor: cardColor,
                borderRadius: 24,
                padding: 20,
                gap: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
            }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: text }}>Details</Text>

                {type === 'timeoff' ? (
                    <>
                        <View style={{ gap: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: muted }}>Duration</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Calendar size={16} color={text} />
                                <Text style={{ fontSize: 16, fontWeight: '500', color: text }}>
                                    {request.request_date_from} → {request.request_date_to}
                                </Text>
                            </View>
                        </View>
                        <View style={{ gap: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: muted }}>Number of Days</Text>
                            <Text style={{ fontSize: 16, fontWeight: '500', color: text }}>
                                {request.number_of_days || 'N/A'} days
                            </Text>
                        </View>
                        {request.name && (
                            <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: muted }}>Reason</Text>
                                <Text style={{ fontSize: 16, fontWeight: '500', color: text }}>{request.name}</Text>
                            </View>
                        )}
                    </>
                ) : (
                    <>
                        <View style={{ gap: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: muted }}>Description</Text>
                            <Text style={{ fontSize: 16, fontWeight: '500', color: text }}>{request.name}</Text>
                        </View>
                        <View style={{ gap: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: muted }}>Date</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Calendar size={16} color={text} />
                                <Text style={{ fontSize: 16, fontWeight: '500', color: text }}>
                                    {request.date || 'N/A'}
                                </Text>
                            </View>
                        </View>
                        {request.product_id && (
                            <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: muted }}>Category</Text>
                                <Text style={{ fontSize: 16, fontWeight: '500', color: text }}>
                                    {request.product_id[1]}
                                </Text>
                            </View>
                        )}
                    </>
                )}

                {request.employee_id && (
                    <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: muted }}>Submitted By</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <User size={16} color={text} />
                            <Text style={{ fontSize: 16, fontWeight: '500', color: text }}>
                                {request.employee_id[1] || 'You'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}
