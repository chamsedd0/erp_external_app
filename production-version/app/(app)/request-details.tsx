import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ChevronLeft, Calendar, DollarSign, Clock, User,
    CheckCircle, XCircle, AlertCircle, Timer, Monitor, Wrench, Briefcase
} from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { useToast } from '../../providers/toast-context';
import { useSession } from '../../providers/auth-context';

type RequestType = 'timeoff' | 'expense' | 'timesheet' | 'helpdesk' | 'maintenance';

export default function RequestDetails() {
    const { id, type } = useLocalSearchParams<{ id: string; type: RequestType }>();
    const router = useRouter();
    const toast = useToast();
    const { user } = useSession();
    const [loading, setLoading] = useState(true);
    const [request, setRequest] = useState<any>(null);

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const semanticSuccess = useColor('semanticSuccess' as any);
    const semanticWarning = useColor('semanticWarning' as any);
    const semanticError = useColor('semanticError' as any);
    const semanticInfo = useColor('semanticInfo' as any);
    const primary = useColor('primary');

    useEffect(() => {
        if (user) fetchRequestDetails();
    }, [id, type, user]);

    const fetchRequestDetails = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            let list: any[] = [];
            if (type === 'timeoff') {
                const data = await apiClient.getTimeOffRequests(user.id);
                list = data.leaves || data.requests || (Array.isArray(data) ? data : []);
            } else if (type === 'expense') {
                const data = await apiClient.getExpenses(user.id);
                list = data.expenses || data.requests || (Array.isArray(data) ? data : []);
            } else if (type === 'timesheet') {
                const data = await apiClient.getTimesheetEntries(user.id);
                list = data.entries || (Array.isArray(data) ? data : []);
            } else if (type === 'helpdesk') {
                const data = await apiClient.getHelpdeskTickets(user.id);
                list = data.tickets || (Array.isArray(data) ? data : []);
            } else if (type === 'maintenance') {
                const data = await apiClient.getMaintenanceRequests(user.id);
                list = data.requests || (Array.isArray(data) ? data : []);
            }
            const found = list.find((r: any) => String(r.id) === String(id));
            setRequest(found || null);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load request details');
        } finally {
            setLoading(false);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Resolves both string state (leave/expense) and stage_id[1] tuple (helpdesk/maintenance) */
    const getStatusConfig = (req: any) => {
        // Helpdesk / Maintenance use stage_id (a [id, name] tuple)
        let statusStr = '';
        if (type === 'helpdesk' || type === 'maintenance') {
            statusStr = Array.isArray(req?.stage_id) ? (req.stage_id[1] as string) : (req?.stage_id || '');
        } else {
            statusStr = req?.state || '';
        }
        const lower = statusStr.toLowerCase();

        if (['validate', 'approve', 'approved', 'done', 'posted', 'closed', 'resolved'].some(s => lower.includes(s))) {
            return { color: semanticSuccess, icon: CheckCircle, label: statusStr || 'Done' };
        } else if (['refuse', 'reject', 'cancel', 'cancelled'].some(s => lower.includes(s))) {
            return { color: semanticError, icon: XCircle, label: statusStr || 'Refused' };
        } else {
            return { color: semanticWarning, icon: AlertCircle, label: statusStr || 'In Progress' };
        }
    };

    const accentColorForType = () => {
        switch (type) {
            case 'timeoff': return semanticInfo;
            case 'expense': return semanticSuccess;
            case 'timesheet': return semanticSuccess;
            case 'helpdesk': return semanticWarning;
            case 'maintenance': return semanticError;
            default: return primary;
        }
    };

    const iconForType = () => {
        switch (type) {
            case 'timeoff': return <Calendar size={32} color={semanticInfo} strokeWidth={1.5} />;
            case 'expense': return <DollarSign size={32} color={semanticSuccess} strokeWidth={1.5} />;
            case 'timesheet': return <Timer size={32} color={semanticSuccess} strokeWidth={1.5} />;
            case 'helpdesk': return <Monitor size={32} color={semanticWarning} strokeWidth={1.5} />;
            case 'maintenance': return <Wrench size={32} color={semanticError} strokeWidth={1.5} />;
        }
    };

    const labelForType = () => {
        switch (type) {
            case 'timeoff': return 'Time Off Request';
            case 'expense': return 'Expense Claim';
            case 'timesheet': return 'Timesheet Entry';
            case 'helpdesk': return 'IT Support Ticket';
            case 'maintenance': return 'Maintenance Request';
        }
    };

    const titleForRequest = () => {
        if (!request) return '';
        switch (type) {
            case 'timeoff': return request.leave_type_id?.[1] || 'Leave';
            case 'expense': return request.name || 'Expense';
            case 'timesheet': return request.name || 'Work Entry';
            case 'helpdesk': return request.name || 'Support Ticket';
            case 'maintenance': return request.name || 'Maintenance';
        }
    };

    // ── Loading / Not Found ────────────────────────────────────────────────────

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

    const accentColor = accentColorForType();
    // Timesheet entries have no approval state — skip the status badge
    const showStatus = type !== 'timesheet';
    const statusConfig = showStatus ? getStatusConfig(request) : null;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ padding: 24, paddingBottom: 180 }}>
            {/* Header */}
            <View style={{ marginBottom: 32, flexDirection: 'row', alignItems: 'center', marginTop: 20 }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: cardColor, alignItems: 'center', justifyContent: 'center',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginRight: 16
                    }}
                >
                    <ChevronLeft size={24} color={text} />
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: text }}>Request Details</Text>
            </View>

            {/* Status Badge — not shown for timesheet (no approval flow) */}
            {showStatus && statusConfig && (() => {
                const StatusIcon = statusConfig.icon;
                return (
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
                        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99, marginBottom: 24,
                        gap: 8, backgroundColor: statusConfig.color + '18',
                    }}>
                        <StatusIcon size={18} color={statusConfig.color} strokeWidth={2.5} />
                        <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: statusConfig.color }}>
                            {statusConfig.label}
                        </Text>
                    </View>
                );
            })()}

            {/* Hero Card */}
            <View style={{
                backgroundColor: accentColor + '18', borderRadius: 32, padding: 32, marginBottom: 24,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: type === 'expense' ? 24 : 0 }}>
                    <View style={{
                        width: 64, height: 64, borderRadius: 24,
                        backgroundColor: accentColor + '28', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {iconForType()}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, opacity: 0.8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {labelForType()}
                        </Text>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 26, color: text, lineHeight: 32 }}>
                            {titleForRequest()}
                        </Text>
                    </View>
                </View>

                {/* Amount hero for expense */}
                {type === 'expense' && (
                    <View style={{ backgroundColor: accentColor + '20', padding: 16, borderRadius: 20 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, opacity: 0.7, marginBottom: 2 }}>Total Amount</Text>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 42, color: text }}>
                            ${request.total_amount || request.unit_amount || '0.00'}
                        </Text>
                    </View>
                )}

                {/* Hours hero for timesheet */}
                {type === 'timesheet' && (
                    <View style={{ backgroundColor: accentColor + '20', padding: 16, borderRadius: 20, marginTop: 16 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, opacity: 0.7, marginBottom: 2 }}>Hours Logged</Text>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 42, color: text }}>
                            {(request.unit_amount || 0).toFixed(1)}<Text style={{ fontSize: 22, fontFamily: 'DMSans_400Regular', color: muted }}> hrs</Text>
                        </Text>
                    </View>
                )}
            </View>

            {/* Details Card */}
            <View style={{
                backgroundColor: cardColor, borderRadius: 24, padding: 24, gap: 24,
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
                borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)',
            }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: text }}>Details</Text>

                {/* ─── Time Off Details ─── */}
                {type === 'timeoff' && (
                    <>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calendar size={16} color={text} />
                                </View>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>
                                    {request.request_date_from} <Text style={{ color: muted }}>→</Text> {request.request_date_to}
                                </Text>
                            </View>
                        </View>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Days</Text>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 24, color: text }}>
                                {request.number_of_days || 'N/A'}{' '}
                                <Text style={{ fontSize: 16, fontFamily: 'DMSans_400Regular', color: muted }}>days</Text>
                            </Text>
                        </View>
                        {request.name ? (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reason</Text>
                                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: text, lineHeight: 24 }}>{request.name}</Text>
                            </View>
                        ) : null}
                    </>
                )}

                {/* ─── Expense Details ─── */}
                {type === 'expense' && (
                    <>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</Text>
                            <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 17, color: text }}>{request.name}</Text>
                        </View>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calendar size={16} color={text} />
                                </View>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>{request.date || 'N/A'}</Text>
                            </View>
                        </View>
                        {Array.isArray(request.product_id) && (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                                        <DollarSign size={16} color={text} />
                                    </View>
                                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>{request.product_id[1]}</Text>
                                </View>
                            </View>
                        )}
                    </>
                )}

                {/* ─── Timesheet Details ─── */}
                {type === 'timesheet' && (
                    <>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calendar size={16} color={text} />
                                </View>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>{request.date || 'N/A'}</Text>
                            </View>
                        </View>
                        {Array.isArray(request.project_id) && (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Project</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Briefcase size={16} color={text} />
                                    </View>
                                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>{request.project_id[1]}</Text>
                                </View>
                            </View>
                        )}
                        {Array.isArray(request.task_id) && request.task_id[1] && (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Task</Text>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>{request.task_id[1]}</Text>
                            </View>
                        )}
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Work Description</Text>
                            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: text, lineHeight: 24 }}>{request.name || '—'}</Text>
                        </View>
                    </>
                )}

                {/* ─── IT Support Details ─── */}
                {type === 'helpdesk' && (
                    <>
                        {Array.isArray(request.team_id) && (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Team</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Monitor size={16} color={text} />
                                    </View>
                                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>{request.team_id[1]}</Text>
                                </View>
                            </View>
                        )}
                        {Array.isArray(request.stage_id) && (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stage</Text>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>{request.stage_id[1]}</Text>
                            </View>
                        )}
                        {request.description ? (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</Text>
                                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: text, lineHeight: 24 }}>{request.description}</Text>
                            </View>
                        ) : null}
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Submitted</Text>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>
                                {request.create_date ? new Date(request.create_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </Text>
                        </View>
                    </>
                )}

                {/* ─── Maintenance Details ─── */}
                {type === 'maintenance' && (
                    <>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Type</Text>
                            <View style={{
                                alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6,
                                borderRadius: 100,
                                backgroundColor: (request.maintenance_type === 'preventive' ? semanticInfo : semanticError) + '20',
                            }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: request.maintenance_type === 'preventive' ? semanticInfo : semanticError, textTransform: 'capitalize' }}>
                                    {request.maintenance_type || 'Corrective'}
                                </Text>
                            </View>
                        </View>
                        {Array.isArray(request.category_id) && (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Wrench size={16} color={text} />
                                    </View>
                                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>{request.category_id[1]}</Text>
                                </View>
                            </View>
                        )}
                        {Array.isArray(request.stage_id) && (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stage</Text>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>{request.stage_id[1]}</Text>
                            </View>
                        )}
                        {request.description ? (
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</Text>
                                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: text, lineHeight: 24 }}>{request.description}</Text>
                            </View>
                        ) : null}
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Submitted</Text>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 17, color: text }}>
                                {request.create_date ? new Date(request.create_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </Text>
                        </View>
                    </>
                )}

                {/* ─── Submitted By (shared) ─── */}
                {request.employee_id && Array.isArray(request.employee_id) && (
                    <>
                        <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 4 }} />
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Submitted By</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: accentColor + '25', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={20} color={accentColor} />
                                </View>
                                <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: text }}>
                                    {request.employee_id[1] || 'You'}
                                </Text>
                            </View>
                        </View>
                    </>
                )}
            </View>
        </ScrollView>
    );
}
