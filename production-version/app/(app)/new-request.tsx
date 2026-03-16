import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { DatePicker } from '../../components/ui/date-picker';
import { AttachmentPicker } from '../../components/AttachmentPicker';
import { useColor } from '../../hooks/useColor';
import {
    Clock, DollarSign, ChevronLeft, Calendar, ArrowRight,
    Timer, Monitor, Wrench
} from 'lucide-react-native';
import { apiClient, type Attachment } from '../../api/client';
import { useSession } from '../../providers/auth-context';
import { useToast } from '../../providers/toast-context';
import { useRouter } from 'expo-router';

type ViewState = 'hub' | 'time-off' | 'expense' | 'helpdesk' | 'maintenance';

export default function NewRequest() {
    const { user } = useSession();
    const toast = useToast();
    const router = useRouter();
    const [currentView, setCurrentView] = useState<ViewState>('hub');
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);

    // ── Data State ─────────────────────────────────────────────────────────────
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [expenseProducts, setExpenseProducts] = useState<any[]>([]);
    const [helpdeskTeams, setHelpdeskTeams] = useState<any[]>([]);
    const [helpdeskAvailable, setHelpdeskAvailable] = useState(true);
    const [maintenanceCategories, setMaintenanceCategories] = useState<any[]>([]);

    // ── Colors ─────────────────────────────────────────────────────────────────
    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const semanticSuccess = useColor('semanticSuccess' as any);
    const semanticWarning = useColor('semanticWarning' as any);
    const semanticError = useColor('semanticError' as any);
    const semanticInfo = useColor('semanticInfo' as any);
    const cardColor = useColor('card');

    // ── Time Off Form State ────────────────────────────────────────────────────
    const [holidayStatusId, setHolidayStatusId] = useState<number | null>(null);
    const [dateFrom, setDateFrom] = useState<Date | null>(null);
    const [dateTo, setDateTo] = useState<Date | null>(null);
    const [reason, setReason] = useState('');
    const [timeOffAttachments, setTimeOffAttachments] = useState<Attachment[]>([]);

    // ── Expense Form State ─────────────────────────────────────────────────────
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState<Date | null>(null);
    const [productId, setProductId] = useState<number | null>(null);
    const [expenseAttachments, setExpenseAttachments] = useState<Attachment[]>([]);

    // ── IT Support Form State ──────────────────────────────────────────────────
    const [hdSubject, setHdSubject] = useState('');
    const [hdDescription, setHdDescription] = useState('');
    const [hdTeamId, setHdTeamId] = useState<number | null>(null);
    const [hdAttachments, setHdAttachments] = useState<Attachment[]>([]);

    // ── Maintenance Form State ─────────────────────────────────────────────────
    const [mntTitle, setMntTitle] = useState('');
    const [mntDescription, setMntDescription] = useState('');
    const [mntCategoryId, setMntCategoryId] = useState<number | null>(null);
    const [mntType, setMntType] = useState<'corrective' | 'preventive'>('corrective');
    const [mntAttachments, setMntAttachments] = useState<Attachment[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setDataLoading(true);
        try {
            // Each call has its own .catch() so a single failure does not block the rest
            const [typesData, productsData, teamsData, categoriesData] = await Promise.all([
                apiClient.getTimeOffTypes().catch(() => ({ types: [] as any[] })),
                apiClient.getExpenseProducts().catch(() => ({ products: [] as any[] })),
                apiClient.getHelpdeskTeams().catch(() => ({ available: false, teams: [] as any[] })),
                apiClient.getMaintenanceCategories().catch(() => ({ categories: [] as any[] })),
            ]);
            const types = (typesData as any).types || [];
            const products = (productsData as any).products || [];
            const categories = (categoriesData as any).categories || [];

            setLeaveTypes(types);
            setExpenseProducts(products);
            if ((teamsData as any).available === false) {
                setHelpdeskAvailable(false);
            } else {
                setHelpdeskTeams((teamsData as any).teams || []);
            }
            setMaintenanceCategories(categories);

            // If all three main data sources came back empty, the API is likely unreachable
            if (types.length === 0 && products.length === 0 && categories.length === 0) {
                toast.error('Could not load form data. Please check your connection.');
            }
        } catch (error) {
            toast.error('Failed to fetch form data. Please check your connection.');
        } finally {
            setDataLoading(false);
        }
    };

    // ── Submit Handlers ────────────────────────────────────────────────────────

    const handleCreateTimeOff = async () => {
        if (!holidayStatusId || !dateFrom || !dateTo) {
            toast.warning('Please select a leave type and dates.');
            return;
        }
        if (!user?.id) { toast.error('User session not found. Please re-login.'); return; }
        setLoading(true);
        try {
            await apiClient.createTimeOffRequest({
                employee_id: user.id,
                leave_type_id: holidayStatusId,
                date_from: dateFrom.toISOString().split('T')[0],
                date_to: dateTo.toISOString().split('T')[0],
                name: reason,
                attachments: timeOffAttachments.length > 0 ? timeOffAttachments : undefined,
            });
            toast.success('Time off request submitted!');
            setCurrentView('hub');
            setHolidayStatusId(null); setDateFrom(null); setDateTo(null);
            setReason(''); setTimeOffAttachments([]);
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateExpense = async () => {
        if (!productId || !amount || !description || !date) {
            toast.warning('Please fill in all required fields.');
            return;
        }
        if (!user?.id) { toast.error('User session not found. Please re-login.'); return; }
        setLoading(true);
        try {
            await apiClient.createExpense({
                employee_id: user.id,
                product_id: productId,
                name: description,
                unit_amount: parseFloat(amount),
                quantity: 1,
                date: date.toISOString().split('T')[0],
                attachments: expenseAttachments.length > 0 ? expenseAttachments : undefined,
            });
            toast.success('Expense claim submitted!');
            setCurrentView('hub');
            setProductId(null); setAmount(''); setDescription('');
            setDate(null); setExpenseAttachments([]);
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit expense');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateHelpdesk = async () => {
        if (!hdSubject.trim()) {
            toast.warning('Please enter a subject.');
            return;
        }
        if (!user?.id) { toast.error('User session not found. Please re-login.'); return; }
        setLoading(true);
        try {
            await apiClient.createHelpdeskTicket({
                employee_id: user.id,
                name: hdSubject.trim(),
                description: hdDescription.trim() || undefined,
                team_id: hdTeamId ?? undefined,
                attachments: hdAttachments.length > 0 ? hdAttachments : undefined,
            });
            toast.success('IT support ticket submitted!');
            setCurrentView('hub');
            setHdSubject(''); setHdDescription(''); setHdTeamId(null); setHdAttachments([]);
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit ticket');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMaintenance = async () => {
        if (!mntTitle.trim()) {
            toast.warning('Please enter a request title.');
            return;
        }
        if (!user?.id) { toast.error('User session not found. Please re-login.'); return; }
        setLoading(true);
        try {
            await apiClient.createMaintenanceRequest({
                employee_id: user.id,
                name: mntTitle.trim(),
                description: mntDescription.trim() || undefined,
                category_id: mntCategoryId ?? undefined,
                maintenance_type: mntType,
                attachments: mntAttachments.length > 0 ? mntAttachments : undefined,
            });
            toast.success('Maintenance request submitted!');
            setCurrentView('hub');
            setMntTitle(''); setMntDescription(''); setMntCategoryId(null);
            setMntType('corrective'); setMntAttachments([]);
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit maintenance request');
        } finally {
            setLoading(false);
        }
    };

    // ── Render: Hub ────────────────────────────────────────────────────────────

    const renderHub = () => (
        <View style={{ gap: 16, paddingVertical: 10 }}>
            <View style={{ marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 32, color: text }}>New Request</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted, marginTop: 8 }}>What would you like to submit today?</Text>
            </View>

            {/* Time Off */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => setCurrentView('time-off')}
                style={{ backgroundColor: 'transparent', borderRadius: 32, padding: 32, borderWidth: 1, borderColor: semanticInfo, overflow: 'hidden', minHeight: 200, justifyContent: 'space-between' }}>
                <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.1, transform: [{ rotate: '15deg' }] }}>
                    <Clock size={160} color={semanticInfo} />
                </View>
                <View style={{ width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticInfo }}>
                    <Clock size={28} color={semanticInfo} strokeWidth={2} />
                </View>
                <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: semanticInfo, marginBottom: 8 }}>Time Off</Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>Vacation, Sick Leave & More</Text>
                </View>
                <View style={{ position: 'absolute', right: 24, bottom: 24, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticInfo }}>
                    <ArrowRight size={24} color={semanticInfo} />
                </View>
            </TouchableOpacity>

            {/* Expense */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => setCurrentView('expense')}
                style={{ backgroundColor: 'transparent', borderRadius: 32, padding: 32, borderWidth: 1, borderColor: semanticSuccess, overflow: 'hidden', minHeight: 200, justifyContent: 'space-between' }}>
                <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.1, transform: [{ rotate: '15deg' }] }}>
                    <DollarSign size={160} color={semanticSuccess} />
                </View>
                <View style={{ width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticSuccess }}>
                    <DollarSign size={28} color={semanticSuccess} strokeWidth={2} />
                </View>
                <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: semanticSuccess, marginBottom: 8 }}>Expense Claim</Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>Reimbursements & Purchases</Text>
                </View>
                <View style={{ position: 'absolute', right: 24, bottom: 24, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticSuccess }}>
                    <ArrowRight size={24} color={semanticSuccess} />
                </View>
            </TouchableOpacity>

            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, paddingHorizontal: 4 }}>More Options</Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Timesheet → dedicated screen */}
                <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(app)/timesheet')}
                    style={{ flex: 1, backgroundColor: 'transparent', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: semanticSuccess, overflow: 'hidden', minHeight: 160, justifyContent: 'space-between' }}>
                    <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.08 }}>
                        <Timer size={100} color={semanticSuccess} />
                    </View>
                    <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticSuccess }}>
                        <Timer size={22} color={semanticSuccess} />
                    </View>
                    <View>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: semanticSuccess, marginBottom: 4 }}>Timesheet</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted }}>Log your hours</Text>
                    </View>
                </TouchableOpacity>

                {/* IT Support → inline form */}
                <TouchableOpacity activeOpacity={0.9}
                    onPress={() => helpdeskAvailable ? setCurrentView('helpdesk') : toast.warning('IT Support is not enabled on your Odoo instance.')}
                    style={{ flex: 1, backgroundColor: 'transparent', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: helpdeskAvailable ? semanticWarning : muted, overflow: 'hidden', minHeight: 160, justifyContent: 'space-between', opacity: helpdeskAvailable ? 1 : 0.5 }}>
                    <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.08 }}>
                        <Monitor size={100} color={semanticWarning} />
                    </View>
                    <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: helpdeskAvailable ? semanticWarning : muted }}>
                        <Monitor size={22} color={helpdeskAvailable ? semanticWarning : muted} />
                    </View>
                    <View>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: helpdeskAvailable ? semanticWarning : muted, marginBottom: 4 }}>IT Support</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted }}>Report an issue</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Maintenance → inline form */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => setCurrentView('maintenance')}
                style={{ backgroundColor: 'transparent', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: semanticError, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 90 }}>
                <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.07 }}>
                    <Wrench size={100} color={semanticError} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticError }}>
                        <Wrench size={24} color={semanticError} />
                    </View>
                    <View>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 22, color: semanticError }}>Maintenance</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: muted }}>Equipment & facility issues</Text>
                    </View>
                </View>
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticError }}>
                    <ArrowRight size={20} color={semanticError} />
                </View>
            </TouchableOpacity>
        </View>
    );

    // ── Render: Time Off Form ──────────────────────────────────────────────────

    const renderTimeOffForm = () => (
        <View style={{ gap: 32 }}>
            <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text }}>New Time Off</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>Fill in the details below</Text>
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Leave Type</Text>
                {dataLoading ? (
                    <View style={{ height: 60, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="small" color={muted} /></View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {leaveTypes.map((type: any) => (
                            <TouchableOpacity key={type.id} onPress={() => setHolidayStatusId(type.id)} activeOpacity={0.7}
                                style={{ backgroundColor: holidayStatusId === type.id ? 'transparent' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: holidayStatusId === type.id ? semanticInfo : 'transparent', minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: holidayStatusId === type.id ? semanticInfo : text }}>{type.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Duration</Text>
                <View style={{ backgroundColor: cardColor, borderRadius: 24, padding: 24, gap: 20 }}>
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>From</Text>
                        <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Select start date" />
                    </View>
                    <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>To</Text>
                        <DatePicker value={dateTo} onChange={setDateTo} placeholder="Select end date" />
                    </View>
                </View>
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Reason (Optional)</Text>
                <Input placeholder="Add a note for your manager..." value={reason} onChangeText={setReason}
                    containerStyle={{ backgroundColor: cardColor, borderWidth: 0, height: 120, borderRadius: 24, padding: 20 }}
                    inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 }}
                    multiline textAlignVertical="top" />
            </View>

            <AttachmentPicker attachments={timeOffAttachments} onChange={setTimeOffAttachments} label="Supporting Documents" />

            <Button size="lg" onPress={handleCreateTimeOff} disabled={loading}
                style={{ borderRadius: 20, marginTop: 8, backgroundColor: semanticInfo, height: 56, shadowColor: semanticInfo, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#fff' }}>Submit Request</Text>}
            </Button>
        </View>
    );

    // ── Render: Expense Form ───────────────────────────────────────────────────

    const renderExpenseForm = () => (
        <View style={{ gap: 32 }}>
            <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text }}>New Expense</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>Enter the amount and details</Text>
            </View>

            <View style={{ alignItems: 'center', paddingVertical: 32, backgroundColor: cardColor, borderRadius: 32 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Total Amount</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 48, color: text, marginRight: 4 }}>$</Text>
                    <Input placeholder="0.00" value={amount} onChangeText={setAmount}
                        containerStyle={{ borderWidth: 0, backgroundColor: 'transparent', width: 200, paddingHorizontal: 0 }}
                        inputStyle={{ fontFamily: 'Outfit_700Bold', fontSize: 48, color: text, textAlign: 'left', height: 60, padding: 0 }}
                        keyboardType="numeric" />
                </View>
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Category</Text>
                {dataLoading ? (
                    <View style={{ height: 60, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="small" color={muted} /></View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {expenseProducts.map((prod: any) => (
                            <TouchableOpacity key={prod.id} onPress={() => setProductId(prod.id)} activeOpacity={0.7}
                                style={{ backgroundColor: productId === prod.id ? 'transparent' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: productId === prod.id ? semanticSuccess : 'transparent', minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: productId === prod.id ? semanticSuccess : text }}>{prod.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Details</Text>
                <View style={{ backgroundColor: cardColor, borderRadius: 24, padding: 24, gap: 20 }}>
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Description</Text>
                        <Input placeholder="What is this expense for?" value={description} onChangeText={setDescription}
                            containerStyle={{ borderWidth: 0, backgroundColor: background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 }}
                            inputStyle={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: text }} />
                    </View>
                    <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Date</Text>
                        <DatePicker value={date} onChange={setDate} placeholder="Select date" />
                    </View>
                </View>
            </View>

            <AttachmentPicker attachments={expenseAttachments} onChange={setExpenseAttachments} label="Receipts" />

            <Button size="lg" onPress={handleCreateExpense} disabled={loading}
                style={{ borderRadius: 20, marginTop: 8, backgroundColor: semanticSuccess, height: 56, shadowColor: semanticSuccess, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#fff' }}>Submit Claim</Text>}
            </Button>
        </View>
    );

    // ── Render: IT Support Form ────────────────────────────────────────────────

    const renderHelpdeskForm = () => (
        <View style={{ gap: 32 }}>
            <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text }}>IT Support Ticket</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>Describe the issue you're experiencing</Text>
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Subject</Text>
                <Input placeholder="e.g. Cannot access company email..." value={hdSubject} onChangeText={setHdSubject}
                    containerStyle={{ backgroundColor: cardColor, borderWidth: 0, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}
                    inputStyle={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: text }} />
            </View>

            {helpdeskTeams.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Team (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {helpdeskTeams.map((team: any) => (
                            <TouchableOpacity key={team.id} onPress={() => setHdTeamId(hdTeamId === team.id ? null : team.id)} activeOpacity={0.7}
                                style={{ backgroundColor: hdTeamId === team.id ? 'transparent' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: hdTeamId === team.id ? semanticWarning : 'transparent', minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: hdTeamId === team.id ? semanticWarning : text }}>{team.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Description (Optional)</Text>
                <Input placeholder="Provide more details about the issue..." value={hdDescription} onChangeText={setHdDescription}
                    containerStyle={{ backgroundColor: cardColor, borderWidth: 0, height: 140, borderRadius: 24, padding: 20 }}
                    inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 }}
                    multiline textAlignVertical="top" />
            </View>

            <AttachmentPicker attachments={hdAttachments} onChange={setHdAttachments} label="Screenshots" />

            <Button size="lg" onPress={handleCreateHelpdesk} disabled={loading}
                style={{ borderRadius: 20, marginTop: 8, backgroundColor: semanticWarning, height: 56, shadowColor: semanticWarning, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#fff' }}>Submit Ticket</Text>}
            </Button>
        </View>
    );

    // ── Render: Maintenance Form ───────────────────────────────────────────────

    const renderMaintenanceForm = () => (
        <View style={{ gap: 32 }}>
            <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text }}>Maintenance Request</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>Report equipment or facility issues</Text>
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Request Title</Text>
                <Input placeholder="e.g. Broken air conditioner in Room 3..." value={mntTitle} onChangeText={setMntTitle}
                    containerStyle={{ backgroundColor: cardColor, borderWidth: 0, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}
                    inputStyle={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: text }} />
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Type</Text>
                <View style={{ flexDirection: 'row', backgroundColor: cardColor, borderRadius: 20, padding: 4 }}>
                    {(['corrective', 'preventive'] as const).map(t => (
                        <TouchableOpacity key={t} onPress={() => setMntType(t)} activeOpacity={0.7}
                            style={{ flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: mntType === t ? semanticError : 'transparent' }}>
                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: mntType === t ? '#fff' : muted }}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {maintenanceCategories.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Category (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {maintenanceCategories.map((cat: any) => (
                            <TouchableOpacity key={cat.id} onPress={() => setMntCategoryId(mntCategoryId === cat.id ? null : cat.id)} activeOpacity={0.7}
                                style={{ backgroundColor: mntCategoryId === cat.id ? 'transparent' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: mntCategoryId === cat.id ? semanticError : 'transparent', minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: mntCategoryId === cat.id ? semanticError : text }}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Description (Optional)</Text>
                <Input placeholder="Provide more details..." value={mntDescription} onChangeText={setMntDescription}
                    containerStyle={{ backgroundColor: cardColor, borderWidth: 0, height: 140, borderRadius: 24, padding: 20 }}
                    inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 }}
                    multiline textAlignVertical="top" />
            </View>

            <AttachmentPicker attachments={mntAttachments} onChange={setMntAttachments} label="Photos of Issue" />

            <Button size="lg" onPress={handleCreateMaintenance} disabled={loading}
                style={{ borderRadius: 20, marginTop: 8, backgroundColor: semanticError, height: 56, shadowColor: semanticError, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#fff' }}>Submit Request</Text>}
            </Button>
        </View>
    );

    // ── Root ───────────────────────────────────────────────────────────────────

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 24, paddingBottom: 180, paddingTop: 24 }}
        >
            {currentView !== 'hub' && (
                <TouchableOpacity onPress={() => setCurrentView('hub')}
                    style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: cardColor, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, marginBottom: 24 }}>
                    <ChevronLeft size={20} color={text} style={{ marginRight: 4 }} />
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: text }}>Back</Text>
                </TouchableOpacity>
            )}

            {currentView === 'hub' && renderHub()}
            {currentView === 'time-off' && renderTimeOffForm()}
            {currentView === 'expense' && renderExpenseForm()}
            {currentView === 'helpdesk' && renderHelpdeskForm()}
            {currentView === 'maintenance' && renderMaintenanceForm()}
        </ScrollView>
    );
}
