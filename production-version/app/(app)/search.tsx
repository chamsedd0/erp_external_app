import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { useRouter } from 'expo-router';
import { Search as SearchIcon, X, Clock, DollarSign, ChevronRight } from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { useSession } from '../../providers/auth-context';

type RequestType = 'all' | 'timeoff' | 'expense';

export default function Search() {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<RequestType>('all');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const router = useRouter();
    const { user } = useSession();

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const pastelPurple = useColor('pastelPurple' as any);
    const pastelBlue = useColor('pastelBlue' as any);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        try {
            // For now, fetch all and filter client-side
            const [timeOffData, expenseData] = await Promise.all([
                apiClient.getPendingTimeOff(),
                apiClient.getPendingExpenses()
            ]);

            let allResults: any[] = [];

            if (filter === 'all' || filter === 'timeoff') {
                const timeOffResults = (timeOffData.requests || []).map((r: any) => ({
                    ...r,
                    type: 'timeoff' as const,
                }));
                allResults = [...allResults, ...timeOffResults];
            }

            if (filter === 'all' || filter === 'expense') {
                const expenseResults = (expenseData.requests || []).map((r: any) => ({
                    ...r,
                    type: 'expense' as const,
                }));
                allResults = [...allResults, ...expenseResults];
            }

            // Filter by query
            const filtered = allResults.filter(r => {
                const searchText = query.toLowerCase();
                const name = (r.name || '').toLowerCase();
                const status = (r.state || '').toLowerCase();
                return name.includes(searchText) || status.includes(searchText);
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

    return (
        <View style={{ flex: 1, backgroundColor: background }}>
            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
                {/* Search Header */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 32, fontWeight: 'bold', color: text, marginBottom: 16 }}>
                        Search
                    </Text>

                    {/* Search Input */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: cardColor,
                        borderRadius: 16,
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

                {/* Filter Tabs */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                    {(['all', 'timeoff', 'expense'] as RequestType[]).map((f) => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setFilter(f)}
                            style={{
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                borderRadius: 20,
                                backgroundColor: filter === f ? pastelPurple : cardColor,
                            }}
                        >
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: filter === f ? '#1a1a1a' : text,
                            }}>
                                {f === 'all' ? 'All' : f === 'timeoff' ? 'Time Off' : 'Expenses'}
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
                                    backgroundColor: result.type === 'timeoff' ? `${pastelPurple}30` : `${pastelBlue}30`,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    {result.type === 'timeoff' ? (
                                        <Clock size={20} color={pastelPurple} />
                                    ) : (
                                        <DollarSign size={20} color={pastelBlue} />
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
                                            ? `${result.request_date_from} - ${result.request_date_to}`
                                            : `$${result.total_amount || result.unit_amount || '0'}`}
                                    </Text>
                                </View>
                                <ChevronRight size={20} color={muted} />
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : query ? (
                    <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                        <SearchIcon size={48} color={muted} opacity={0.3} />
                        <Text style={{ fontSize: 18, fontWeight: '600', color: text, marginTop: 16, marginBottom: 8 }}>
                            No results found
                        </Text>
                        <Text style={{ fontSize: 14, color: muted, textAlign: 'center' }}>
                            Try a different search term
                        </Text>
                    </View>
                ) : (
                    <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                        <SearchIcon size={48} color={muted} opacity={0.3} />
                        <Text style={{ fontSize: 18, fontWeight: '600', color: text, marginTop: 16, marginBottom: 8 }}>
                            Search your requests
                        </Text>
                        <Text style={{ fontSize: 14, color: muted, textAlign: 'center' }}>
                            Enter a search term above to get started
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
