import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Search as SearchIcon, X, Clock, DollarSign, ChevronRight, ChevronLeft, Filter } from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { useSession } from '../../providers/auth-context';

type RequestType = 'all' | 'timeoff' | 'expense';
type DateFilter = 'all' | 'this_month' | 'last_month';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'draft';

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

            // Fetch ALL requests
            const [timeOffData, expenseData] = await Promise.all([
                apiClient.getTimeOffRequests(user.id),
                apiClient.getExpenses(user.id)
            ]);

            let allResults: any[] = [];

            if (typeFilter === 'all' || typeFilter === 'timeoff') {
                const timeOffResults = (timeOffData.leaves || []).map((r: any) => ({
                    ...r,
                    type: 'timeoff' as const,
                }));
                allResults = [...allResults, ...timeOffResults];
            }

            if (typeFilter === 'all' || typeFilter === 'expense') {
                const expenseResults = (expenseData.expenses || []).map((r: any) => ({
                    ...r,
                    type: 'expense' as const,
                }));
                allResults = [...allResults, ...expenseResults];
            }

            // Filter by query, status, and date
            const filtered = allResults.filter(r => {
                const searchText = query.toLowerCase();
                const name = (r.name || '').toLowerCase();
                const status = (r.state || '').toLowerCase();
                const date = new Date(r.date || r.date_from || r.create_date);

                // Query Filter
                const matchesQuery = !query || name.includes(searchText) || status.includes(searchText);

                // Status Filter
                let matchesStatus = true;
                if (statusFilter === 'pending') {
                    matchesStatus = ['draft', 'reported', 'confirm', 'validate1'].includes(status);
                } else if (statusFilter === 'approved') {
                    matchesStatus = ['approved', 'done', 'posted', 'validate'].includes(status);
                } else if (statusFilter === 'rejected') {
                    matchesStatus = ['refuse', 'reject', 'cancel'].includes(status);
                } else if (statusFilter === 'draft') {
                    matchesStatus = ['draft'].includes(status);
                }

                // Date Filter
                let matchesDate = true;
                const now = new Date();
                if (dateFilter === 'this_month') {
                    matchesDate = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                } else if (dateFilter === 'last_month') {
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    matchesDate = date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
                }

                return matchesQuery && matchesStatus && matchesDate;
            });

            // Sort by date (newest first)
            filtered.sort((a, b) => {
                const dateA = a.date || a.date_from || '';
                const dateB = b.date || b.date_from || '';
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            });

            setResults(filtered);
        } catch (error) {
            console.error(error);
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

    const getStatusColor = (status: string) => {
        if (status === 'pending') return semanticWarning;
        if (status === 'approved') return semanticSuccess;
        if (status === 'rejected') return semanticError;
        return text;
    };

    return (
        <View style={{ flex: 1, backgroundColor: background }}>
            <View style={{ padding: 24, paddingBottom: 12, paddingTop: 60 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                    <TouchableOpacity onPress={() => router.push('/(app)/dashboard')} style={{ marginRight: 16 }}>
                        <ChevronLeft size={24} color={text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 32, fontWeight: 'bold', color: text }}>
                        Search
                    </Text>
                </View>

                {/* Search Input */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: cardColor,
                    borderRadius: 100,
                    paddingHorizontal: 16,
                    height: 56,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                }}>
                    <SearchIcon size={20} color={muted} />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search requests..."
                        placeholderTextColor={muted}
                        style={{
                            flex: 1,
                            fontSize: 16,
                            color: text,
                            marginLeft: 12,
                            marginRight: 12,
                        }}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {query && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <X size={20} color={muted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 16 }} />

            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 180 }}>
                {/* Type Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {(['all', 'timeoff', 'expense'] as RequestType[]).map((f) => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setTypeFilter(f)}
                            style={{
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                borderRadius: 20,
                                backgroundColor: typeFilter === f ? 'transparent' : cardColor,
                                borderWidth: 1,
                                borderColor: typeFilter === f ? semanticInfo : 'transparent',
                                marginRight: 12,
                            }}
                        >
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: typeFilter === f ? semanticInfo : text,
                            }}>
                                {f === 'all' ? 'All Types' : f === 'timeoff' ? 'Time Off' : 'Expenses'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Status Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((f) => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setStatusFilter(f)}
                            style={{
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                borderRadius: 20,
                                backgroundColor: statusFilter === f ? getStatusColor(f) + '20' : cardColor,
                                borderWidth: 1,
                                borderColor: statusFilter === f ? getStatusColor(f) : 'transparent',
                                marginRight: 12,
                            }}
                        >
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: statusFilter === f ? getStatusColor(f) : text,
                                textTransform: 'capitalize'
                            }}>
                                {f}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Date Filters */}
                <View style={{ marginBottom: 24, flexDirection: 'row', gap: 12 }}>
                    {(['all', 'this_month', 'last_month'] as DateFilter[]).map((f) => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setDateFilter(f)}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: 12,
                                backgroundColor: dateFilter === f ? 'rgba(0,0,0,0.05)' : 'transparent',
                            }}
                        >
                            <Text style={{
                                fontSize: 13,
                                fontWeight: dateFilter === f ? '600' : '400',
                                color: text,
                            }}>
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
                                    backgroundColor: cardColor,
                                    borderRadius: 20,
                                    padding: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 8,
                                    elevation: 2,
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: 'transparent',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: result.type === 'timeoff' ? semanticInfo : semanticSuccess,
                                }}>
                                    {result.type === 'timeoff' ? (
                                        <Clock size={20} color={semanticInfo} />
                                    ) : (
                                        <DollarSign size={20} color={semanticSuccess} />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginBottom: 2 }}>
                                        {result.type === 'timeoff'
                                            ? result.holiday_status_id?.[1] || 'Time Off'
                                            : result.name}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: muted }}>
                                        {result.type === 'timeoff'
                                            ? `${result.request_date_from || result.date_from} • ${result.state}`
                                            : `$${result.total_amount || result.unit_amount || '0'} • ${result.state}`}
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
                )
                }
            </ScrollView >
        </View >
    );
}
