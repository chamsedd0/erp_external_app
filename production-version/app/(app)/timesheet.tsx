import { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Animated, RefreshControl } from 'react-native';
import { Text } from '../../components/ui/text';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { DatePicker } from '../../components/ui/date-picker';
import { useColor } from '../../hooks/useColor';
import { Timer, ChevronLeft, Clock, Briefcase, ListChecks, PlusCircle } from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { useSession } from '../../providers/auth-context';
import { useToast } from '../../providers/toast-context';
import { useFocusEffect, useRouter } from 'expo-router';

type TabState = 'log' | 'history';

export default function Timesheet() {
    const { user } = useSession();
    const toast = useToast();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<TabState>('log');
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // ── Colors ────────────────────────────────────────────────────────────────
    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const primary = useColor('primary');
    const semanticSuccess = useColor('semanticSuccess' as any);
    const semanticInfo = useColor('semanticInfo' as any);

    // ── Data ──────────────────────────────────────────────────────────────────
    const [projects, setProjects] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);

    // ── Form State ────────────────────────────────────────────────────────────
    const [projectId, setProjectId] = useState<number | null>(null);
    const [taskId, setTaskId] = useState<number | null>(null);
    const [date, setDate] = useState<Date | null>(null);
    const [hours, setHours] = useState('');
    const [description, setDescription] = useState('');
    const [tasksLoading, setTasksLoading] = useState(false);

    // ── Animation ─────────────────────────────────────────────────────────────
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchInitialData();
        }, [])
    );

    const fetchInitialData = async () => {
        setDataLoading(true);
        try {
            const [projectsData] = await Promise.all([
                apiClient.getProjects(),
            ]);
            setProjects(projectsData.projects || []);
        } catch (error) {
            toast.error('Failed to load projects. Please try again.');
        } finally {
            setDataLoading(false);
        }
    };

    const fetchHistory = async () => {
        if (!user?.id) return;
        setHistoryLoading(true);
        try {
            const data = await apiClient.getTimesheetEntries(user.id);
            setHistory(data.entries || []);
        } catch (error) {
            toast.error('Failed to load timesheet history.');
        } finally {
            setHistoryLoading(false);
            setRefreshing(false);
        }
    };

    const handleTabChange = (tab: TabState) => {
        setActiveTab(tab);
        if (tab === 'history' && history.length === 0) {
            fetchHistory();
        }
    };

    const handleProjectSelect = async (id: number) => {
        setProjectId(id);
        setTaskId(null);
        setTasks([]);
        setTasksLoading(true);
        try {
            const data = await apiClient.getTasks(id);
            setTasks(data.tasks || []);
        } catch (error) {
            setTasks([]);
            toast.error('Could not load tasks for this project.');
        } finally {
            setTasksLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!projectId) {
            toast.warning('Please select a project.');
            return;
        }
        if (!date) {
            toast.warning('Please select a date.');
            return;
        }
        const parsedHours = parseFloat(hours);
        if (!hours || isNaN(parsedHours) || parsedHours <= 0) {
            toast.warning('Please enter a valid number of hours.');
            return;
        }
        if (!description.trim()) {
            toast.warning('Please add a work description.');
            return;
        }
        if (!user?.id) {
            toast.error('User session not found. Please re-login.');
            return;
        }

        setLoading(true);
        try {
            await apiClient.createTimesheetEntry({
                employee_id: user.id,
                project_id: projectId,
                task_id: taskId ?? undefined,
                date: date.toISOString().split('T')[0],
                unit_amount: parsedHours,
                name: description.trim(),
            });
            toast.success('Timesheet entry logged!');
            // Reset form
            setProjectId(null);
            setTaskId(null);
            setDate(null);
            setHours('');
            setDescription('');
            setTasks([]);
            // Refresh history if it's been loaded
            if (history.length > 0) fetchHistory();
        } catch (error: any) {
            toast.error(error.message || 'Failed to log timesheet entry.');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    const groupByDate = (entries: any[]) => {
        const grouped: Record<string, any[]> = {};
        entries.forEach(entry => {
            const day = entry.date || 'Unknown';
            if (!grouped[day]) grouped[day] = [];
            grouped[day].push(entry);
        });
        return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        } catch { return dateStr; }
    };

    const totalHoursForDate = (entries: any[]) =>
        entries.reduce((sum, e) => sum + (e.unit_amount || 0), 0).toFixed(1);

    // ── Render ─────────────────────────────────────────────────────────────────

    const renderTabBar = () => (
        <View style={{
            flexDirection: 'row',
            backgroundColor: cardColor,
            borderRadius: 20,
            padding: 4,
            marginBottom: 28,
        }}>
            {(['log', 'history'] as TabState[]).map(tab => (
                <TouchableOpacity
                    key={tab}
                    onPress={() => handleTabChange(tab)}
                    activeOpacity={0.7}
                    style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 16,
                        alignItems: 'center',
                        backgroundColor: activeTab === tab ? semanticSuccess : 'transparent',
                    }}
                >
                    <Text style={{
                        fontFamily: 'DMSans_700Bold',
                        fontSize: 15,
                        color: activeTab === tab ? '#fff' : muted,
                    }}>
                        {tab === 'log' ? 'Log Hours' : 'History'}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderLogForm = () => (
        <View style={{ gap: 28 }}>
            {/* Project Selector */}
            <View style={{ gap: 14 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Project</Text>
                {dataLoading ? (
                    <View style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="small" color={muted} />
                    </View>
                ) : projects.length === 0 ? (
                    <View style={{ padding: 20, backgroundColor: cardColor, borderRadius: 20, alignItems: 'center' }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', color: muted, fontSize: 15 }}>No active projects found</Text>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                        {projects.map((proj: any) => (
                            <TouchableOpacity
                                key={proj.id}
                                onPress={() => handleProjectSelect(proj.id)}
                                activeOpacity={0.7}
                                style={{
                                    backgroundColor: projectId === proj.id ? 'transparent' : cardColor,
                                    paddingHorizontal: 20,
                                    paddingVertical: 14,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: projectId === proj.id ? semanticSuccess : 'transparent',
                                    shadowColor: projectId === proj.id ? semanticSuccess : '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: projectId === proj.id ? 0.3 : 0.03,
                                    shadowRadius: 8,
                                    elevation: projectId === proj.id ? 4 : 2,
                                    minWidth: 100,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{
                                    fontFamily: 'DMSans_700Bold',
                                    fontSize: 15,
                                    color: projectId === proj.id ? semanticSuccess : text,
                                }}>
                                    {proj.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Task Selector — only visible after a project is selected */}
            {projectId !== null && (
                <View style={{ gap: 14 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Task (Optional)</Text>
                    {tasksLoading ? (
                        <View style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="small" color={muted} />
                        </View>
                    ) : tasks.length === 0 ? (
                        <View style={{ padding: 14, backgroundColor: cardColor, borderRadius: 16, alignItems: 'center' }}>
                            <Text style={{ fontFamily: 'DMSans_400Regular', color: muted, fontSize: 14 }}>No tasks for this project</Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                            {tasks.map((task: any) => (
                                <TouchableOpacity
                                    key={task.id}
                                    onPress={() => setTaskId(taskId === task.id ? null : task.id)}
                                    activeOpacity={0.7}
                                    style={{
                                        backgroundColor: taskId === task.id ? 'transparent' : cardColor,
                                        paddingHorizontal: 18,
                                        paddingVertical: 12,
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: taskId === task.id ? semanticInfo : 'transparent',
                                        shadowColor: taskId === task.id ? semanticInfo : '#000',
                                        shadowOffset: { width: 0, height: 3 },
                                        shadowOpacity: taskId === task.id ? 0.25 : 0.03,
                                        shadowRadius: 6,
                                        elevation: taskId === task.id ? 3 : 1,
                                        minWidth: 90,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text style={{
                                        fontFamily: 'DMSans_500Medium',
                                        fontSize: 14,
                                        color: taskId === task.id ? semanticInfo : text,
                                    }}>
                                        {task.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}

            {/* Date + Hours Card */}
            <View style={{ gap: 14 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Details</Text>
                <View style={{
                    backgroundColor: cardColor,
                    borderRadius: 24,
                    padding: 24,
                    gap: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.03,
                    shadowRadius: 12,
                    elevation: 2,
                }}>
                    <View style={{ gap: 10 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Date</Text>
                        <DatePicker
                            value={date}
                            onChange={setDate}
                            placeholder="Select date"
                        />
                    </View>

                    <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />

                    {/* Hours — hero big input */}
                    <View style={{ gap: 10 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Hours Worked</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{
                                width: 48, height: 48, borderRadius: 16,
                                backgroundColor: background,
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Clock size={22} color={semanticSuccess} />
                            </View>
                            <Input
                                placeholder="e.g. 2.5"
                                value={hours}
                                onChangeText={setHours}
                                keyboardType="decimal-pad"
                                containerStyle={{
                                    flex: 1,
                                    borderWidth: 0,
                                    backgroundColor: background,
                                    borderRadius: 16,
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                }}
                                inputStyle={{
                                    fontFamily: 'Outfit_700Bold',
                                    fontSize: 28,
                                    color: text,
                                }}
                            />
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>hrs</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Description */}
            <View style={{ gap: 14 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Work Description</Text>
                <Input
                    placeholder="What did you work on?"
                    value={description}
                    onChangeText={setDescription}
                    containerStyle={{
                        backgroundColor: cardColor,
                        borderWidth: 0,
                        height: 120,
                        borderRadius: 24,
                        padding: 20,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.03,
                        shadowRadius: 12,
                        elevation: 2,
                    }}
                    inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 }}
                    multiline
                    textAlignVertical="top"
                />
            </View>

            {/* Submit */}
            <Button
                size="lg"
                onPress={handleSubmit}
                disabled={loading}
                style={{
                    borderRadius: 20,
                    marginTop: 4,
                    backgroundColor: semanticSuccess,
                    height: 56,
                    shadowColor: semanticSuccess,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                    elevation: 6,
                }}
            >
                {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#fff' }}>Log Hours</Text>
                }
            </Button>
        </View>
    );

    const renderHistory = () => {
        if (historyLoading) {
            return (
                <View style={{ paddingTop: 60, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={semanticSuccess} />
                    <Text style={{ fontFamily: 'DMSans_500Medium', color: muted, marginTop: 16, fontSize: 15 }}>
                        Loading history...
                    </Text>
                </View>
            );
        }

        if (history.length === 0) {
            return (
                <View style={{
                    paddingVertical: 60,
                    alignItems: 'center',
                    backgroundColor: cardColor,
                    borderRadius: 28,
                    gap: 12,
                }}>
                    <View style={{
                        width: 64, height: 64, borderRadius: 24,
                        backgroundColor: background,
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <ListChecks size={30} color={muted} />
                    </View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: text }}>No entries yet</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', color: muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>
                        Log your first hours using the "Log Hours" tab.
                    </Text>
                </View>
            );
        }

        const grouped = groupByDate(history);

        return (
            <View style={{ gap: 24 }}>
                {grouped.map(([dateStr, entries]) => (
                    <View key={dateStr} style={{ gap: 10 }}>
                        {/* Date header with total */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                {formatDate(dateStr)}
                            </Text>
                            <View style={{
                                flexDirection: 'row', alignItems: 'center', gap: 4,
                                backgroundColor: cardColor,
                                paddingHorizontal: 12, paddingVertical: 5,
                                borderRadius: 100,
                            }}>
                                <Clock size={12} color={semanticSuccess} />
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 13, color: semanticSuccess }}>
                                    {totalHoursForDate(entries)}h total
                                </Text>
                            </View>
                        </View>

                        {/* Entry rows */}
                        {entries.map((entry: any) => (
                            <View
                                key={entry.id}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: 18,
                                    backgroundColor: cardColor,
                                    borderRadius: 22,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 3 },
                                    shadowOpacity: 0.04,
                                    shadowRadius: 10,
                                    elevation: 2,
                                    gap: 14,
                                }}
                            >
                                {/* Icon */}
                                <View style={{
                                    width: 48, height: 48, borderRadius: 18,
                                    backgroundColor: background,
                                    alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Briefcase size={22} color={semanticSuccess} />
                                </View>

                                {/* Info */}
                                <View style={{ flex: 1, gap: 3 }}>
                                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: text }} numberOfLines={1}>
                                        {entry.name || 'Work'}
                                    </Text>
                                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted }} numberOfLines={1}>
                                        {Array.isArray(entry.project_id) ? entry.project_id[1] : '—'}
                                        {Array.isArray(entry.task_id) && entry.task_id[1] ? ` · ${entry.task_id[1]}` : ''}
                                    </Text>
                                </View>

                                {/* Hours badge */}
                                <View style={{
                                    backgroundColor: 'transparent',
                                    borderWidth: 1,
                                    borderColor: semanticSuccess,
                                    paddingHorizontal: 14,
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                }}>
                                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: semanticSuccess }}>
                                        {(entry.unit_amount || 0).toFixed(1)}h
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ))}
            </View>
        );
    };

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 24, paddingBottom: 180, paddingTop: 24 }}
            refreshControl={
                activeTab === 'history'
                    ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    : undefined
            }
        >
            {/* Header */}
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <TouchableOpacity onPress={() => router.navigate('/(app)/new-request')}
                    style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: cardColor, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, marginBottom: 20 }}>
                    <ChevronLeft size={20} color={text} style={{ marginRight: 4 }} />
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: text }}>Back</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 6 }}>
                    <View style={{
                        width: 52, height: 52, borderRadius: 20,
                        backgroundColor: 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: semanticSuccess,
                    }}>
                        <Timer size={26} color={semanticSuccess} />
                    </View>
                    <View>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 30, color: text }}>Timesheet</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: muted }}>Log and view your hours</Text>
                    </View>
                </View>
            </Animated.View>

            <View style={{ height: 28 }} />

            {/* Tab Bar */}
            {renderTabBar()}

            {/* Content */}
            {activeTab === 'log' ? renderLogForm() : renderHistory()}
        </ScrollView>
    );
}
