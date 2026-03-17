import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Search as SearchIcon, X, Clock, DollarSign, ChevronRight, ChevronLeft, Filter, Monitor, Wrench, Timer } from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { useSession } from '../../providers/auth-context';
import { useToast } from '../../providers/toast-context';

type RequestType = 'all' | 'timeoff' | 'expense' | 'helpdesk' | 'maintenance' | 'timesheet';
type DateFilter = 'all' | 'this_month' | 'last_month';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function Search() {
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<RequestType>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useSession();
    const toast = useToast();

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
        if (params.status === 'pending') {
            setStatusFilter('pending');
        }
    }, [params.status]);

    useEffect(() => {
        handleSearch();
    }, [typeFilter, statusFilter, dateFilter]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            if (!user?.id) return;

            const [timeOffData, expenseData, helpdeskData, maintenanceData, timesheetData] = await Promise.all([
                (typeFilter === 'all' || typeFilter === 'timeoff')
                    ? apiClient.getTimeOffRequests(user.id).catch(() => ({ leaves: [] as any[] }))
                    : Promise.resolve({ leaves: [] as any[] }),
                (typeFilter === 'all' || typeFilter === 'expense')
                    ? apiClient.getExpenses(user.id).catch(() => ({ expenses: [] as any[] }))
                    : Promise.resolve({ expenses: [] as any[] }),
                (typeFilter === 'all' || typeFilter === 'helpdesk')
                    ? apiClient.getHelpdeskTickets(user.id).catch(() => ({ tickets: [] as any[] }))
                    : Promise.resolve({ tickets: [] as any[] }),
                (typeFilter === 'all' || typeFilter === 'maintenance')
                    ? apiClient.getMaintenanceRequests(user.id).catch(() => ({ requests: [] as any[] }))
                    : Promise.resolve({ requests: [] as any[] }),
                (typeFilter === 'all' || typeFilter === 'timesheet')
                    ? apiClient.getTimesheetEntries(user.id).catch(() => ({ entries: [] as any[] }))
                    : Promise.resolve({ entries: [] as any[] }),
            ]);

            let allResults: any[] = [
                ...(timeOffData.leaves || []).map((r: any) => ({ ...r, type: 'timeoff' as const })),
                ...(expenseData.expenses || []).map((r: any) => ({ ...r, type: 'expense' as const })),
                ...((helpdeskData as any).tickets || []).map((r: any) => ({ ...r, type: 'helpdesk' as const })),
                ...((maintenanceData as any).requests || []).map((r: any) => ({ ...r, type: 'maintenance' as const })),
                ...((timesheetData as any).entries || []).map((r: any) => ({ ...r, type: 'timesheet' as const })),
            ];

            // Normalise status label for helpdesk/maintenance (stage_id is a [id, name] tuple)
            allResults = allResults.map(r => {
                if (r.type === 'helpdesk' || r.type === 'maintenance') {
                    return { ...r, _statusLabel: Array.isArray(r.stage_id) ? r.stage_id[1] : (r.stage_id || '') };
                }
                return { ...r, _statusLabel: r.state || '' };
            });

            const filtered = allResults.filter(r => {
                const searchText = query.toLowerCase();
                const name = (r.name || '').toLowerCase();
                const statusLabel = (r._statusLabel || '').toLowerCase();
                const state = (r.state || '').toLowerCase();

                const matchesQuery = !query || name.includes(searchText) || statusLabel.includes(searchText);

                let matchesStatus = true;
                if (r.type === 'timesheet') {
                    // Timesheet has no approval state — only show when statusFilter is 'all'
                    matchesStatus = statusFilter === 'all';
                } else if (statusFilter === 'pending') {
                    matchesStatus =
                        ['draft', 'reported', 'confirm', 'validate1'].includes(state) ||
                        ['new', 'in progress', 'open'].some(s => statusLabel.includes(s));
                } else if (statusFilter === 'approved') {
                    matchesStatus =
                        ['approved', 'done', 'posted', 'validate'].includes(state) ||
                        ['closed', 'resolved', 'done'].some(s => statusLabel.includes(s));
                } else if (statusFilter === 'rejected') {
                    matchesStatus =
                        ['refuse', 'reject', 'cancel'].includes(state) ||
                        ['cancelled', 'rejected'].some(s => statusLabel.includes(s));
                }

                const rawDate = r.date || r.date_from || r.request_date_from || r.create_date;
                const date = rawDate ? new Date(rawDate) : null;
                let matchesDate = true;
                if (date && dateFilter !== 'all') {
                    const now = new Date();
                    if (dateFilter === 'this_month') {
                        matchesDate = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                    } else if (dateFilter === 'last_month') {
                        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        matchesDate = date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
                    }
                }

                return matchesQuery && matchesStatus && matchesDate;
            });

            filtered.sort((a, b) => {
                const da = a.date || a.date_from || a.request_date_from || a.create_date || '';
                const db = b.date || b.date_from || b.request_date_from || b.create_date || '';
                return new Date(db).getTime() - new Date(da).getTime();
            });

            setResults(filtered);
        } catch (error) {
            console.error(error);
            toast.error('Could not load results. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const navigateToRequest = (result: any) => {
        router.push({
            pathname: '/(app)/request-details',
            params: { id: result.id.toString(), type: result.type },
        });
    };

    const getTypeColor = (type: RequestType | string) => {
        switch (type) {
            case 'timeoff': return semanticInfo;
            case 'expense': return semanticSuccess;
            case 'helpdesk': return semanticWarning;
            case 'maintenance': return semanticError;
            case 'timesheet': return semanticSuccess;
            default: return primary;
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'timeoff': return <Clock size={20} color={semanticInfo} />;
            case 'expense': return <DollarSign size={20} color={semanticSuccess} />;
            case 'helpdesk': return <Monitor size={20} color={semanticWarning} />;
            case 'maintenance': return <Wrench size={20} color={semanticError} />;
            case 'timesheet': return <Timer size={20} color={semanticSuccess} />;
            default: return <Filter size={20} color={muted} />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'timeoff': return 'Time Off';
            case 'expense': return 'Expense';
            case 'helpdesk': return 'IT Support';
            case 'maintenance': return 'Maintenance';
            case 'timesheet': return 'Timesheet';
            default: return type;
        }
    };

    const getResultTitle = (r: any) => {
        if (r.type === 'timeoff') return r.leave_type_id?.[1] || r.name || 'Time Off';
        return r.name || getTypeLabel(r.type);
    };

    const getResultSubtitle = (r: any) => {
        switch (r.type) {
            case 'timeoff':
                return `${r.request_date_from || r.date_from || ''} • ${r._statusLabel}`;
            case 'expense':
                return `$${r.total_amount || r.unit_amount || '0'} • ${r._statusLabel}`;
            case 'timesheet':
                return `${(r.unit_amount || 0).toFixed(1)} hrs • ${r.date || ''}`;
            default:
                return r._statusLabel || 'In Progress';
        }
    };

    const getStatusColor = (s: StatusFilter) => {
        if (s === 'pending') return semanticWarning;
        if (s === 'approved') return semanticSuccess;
        if (s === 'rejected') return semanticError;
        return text;
    };

    const typeFilters: { key: RequestType; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'timeoff', label: 'Time Off' },
        { key: 'expense', label: 'Expenses' },
        { key: 'helpdesk', label: 'IT Support' },
        { key: 'maintenance', label: 'Maintenance' },
        { key: 'timesheet', label: 'Timesheet' },
    ];

    const statusFilters: { key: StatusFilter; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'pending', label: 'Pending' },
        { key: 'approved', label: 'Approved' },
        { key: 'rejected', label: 'Rejected' },
    ];

    return (
        <View style={{ flex: 1, backgroundColor: background }}>
            <View style={{ padding: 24, paddingBottom: 12, paddingTop: 60 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                    <TouchableOpacity onPress={() => router.push('/(app)/dashboard')} style={{ marginRight: 16 }}>
                        <ChevronLeft size={24} color={text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 32, fontWeight: 'bold', color: text }}>Search</Text>
                </View>

                {/* Search Input */}
                <View style={{
                    flexDirection: 'row', alignItems: 'center', backgroundColor: cardColor,
                    borderRadius: 100, paddingHorizontal: 16, height: 56,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
                }}>
                    <SearchIcon size={20} color={muted} />
                    <TextInput
                        value={query} onChangeText={setQuery} placeholder="Search requests..."
                        placeholderTextColor={muted}
                        style={{ flex: 1, fontSize: 16, color: text, marginLeft: 12, marginRight: 12 }}
                        onSubmitEditing={handleSearch} returnKeyType="search"
                    />
                    {query ? (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <X size={20} color={muted} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 16 }} />

            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 180 }}>
                {/* Type Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {typeFilters.map(({ key, label }) => {
                        const active = typeFilter === key;
                        const color = getTypeColor(key);
                        return (
                            <TouchableOpacity key={key} onPress={() => setTypeFilter(key)}
                                style={{
                                    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
                                    backgroundColor: active ? 'transparent' : cardColor,
                                    borderWidth: 1, borderColor: active ? color : 'transparent', marginRight: 10,
                                }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: active ? color : text }}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Status Filters — hidden for timesheet (no approval flow) */}
                {typeFilter !== 'timesheet' && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        {statusFilters.map(({ key, label }) => {
                            const active = statusFilter === key;
                            const color = getStatusColor(key);
                            return (
                                <TouchableOpacity key={key} onPress={() => setStatusFilter(key)}
                                    style={{
                                        paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
                                        backgroundColor: active ? color + '20' : cardColor,
                                        borderWidth: 1, borderColor: active ? color : 'transparent', marginRight: 10,
                                    }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: active ? color : text, textTransform: 'capitalize' }}>
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                {/* Date Filters */}
                <View style={{ marginBottom: 24, flexDirection: 'row', gap: 12 }}>
                    {(['all', 'this_month', 'last_month'] as DateFilter[]).map((f) => (
                        <TouchableOpacity key={f} onPress={() => setDateFilter(f)}
                            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: dateFilter === f ? 'rgba(0,0,0,0.05)' : 'transparent' }}>
                            <Text style={{ fontSize: 13, fontWeight: dateFilter === f ? '600' : '400', color: text }}>
                                {f === 'all' ? 'Any Date' : f === 'this_month' ? 'This Month' : 'Last Month'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Results */}
                {loading ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" />
                    </View>
                ) : results.length > 0 ? (
                    <View style={{ gap: 12 }}>
                        {results.map((result) => (
                            <TouchableOpacity
                                key={`${result.type}-${result.id}`}
                                onPress={() => navigateToRequest(result)}
                                style={{
                                    backgroundColor: cardColor, borderRadius: 20, padding: 16,
                                    flexDirection: 'row', alignItems: 'center', gap: 12,
                                    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
                                }}
                            >
                                <View style={{
                                    width: 40, height: 40, borderRadius: 20, backgroundColor: 'transparent',
                                    alignItems: 'center', justifyContent: 'center',
                                    borderWidth: 1, borderColor: getTypeColor(result.type),
                                }}>
                                    {getTypeIcon(result.type)}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: getTypeColor(result.type), textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                                        {getTypeLabel(result.type)}
                                    </Text>
                                    <Text style={{ fontSize: 15, fontWeight: '600', color: text, marginBottom: 2 }}>
                                        {getResultTitle(result)}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: muted }}>
                                        {getResultSubtitle(result)}
                                    </Text>
                                </View>
                                <ChevronRight size={20} color={muted} />
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                        <Filter size={48} color={muted} opacity={0.3} />
                        <Text style={{ fontSize: 18, fontWeight: '600', color: text, marginTop: 16, marginBottom: 8 }}>
                            No requests found
                        </Text>
                        <Text style={{ fontSize: 14, color: muted, textAlign: 'center', marginHorizontal: 32 }}>
                            We couldn't find any requests matching your current filters.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
