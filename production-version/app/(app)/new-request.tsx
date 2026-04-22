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
    Timer, Monitor, Wrench, UserCheck, Star, RefreshCw,
} from 'lucide-react-native';
import { apiClient, type Attachment } from '../../api/client';
import { useSession } from '../../providers/auth-context';
import { useToast } from '../../providers/toast-context';
import { useRouter } from 'expo-router';

type ViewState = 'hub' | 'time-off' | 'expense' | 'helpdesk' | 'maintenance' | 'attendance';
type AttSubType = 'correction' | 'overtime' | 'justification';
type Priority = '0' | '1' | '2' | '3';

export default function NewRequest() {
    const { user } = useSession();
    const toast = useToast();
    const router = useRouter();
    const [currentView, setCurrentView] = useState<ViewState>('hub');
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [productsLoadError, setProductsLoadError] = useState(false);

    // ── Data State ─────────────────────────────────────────────────────────────
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [expenseProducts, setExpenseProducts] = useState<any[]>([]);
    const [expenseTaxes, setExpenseTaxes] = useState<any[]>([]);
    const [helpdeskTeams, setHelpdeskTeams] = useState<any[]>([]);
    const [helpdeskAvailable, setHelpdeskAvailable] = useState(true);
    const [helpdeskTicketTypes, setHelpdeskTicketTypes] = useState<any[]>([]);
    const [helpdeskTags, setHelpdeskTags] = useState<any[]>([]);
    const [helpdeskAgents, setHelpdeskAgents] = useState<any[]>([]);
    const [maintenanceCategories, setMaintenanceCategories] = useState<any[]>([]);
    const [maintenanceEquipment, setMaintenanceEquipment] = useState<any[]>([]);
    const [maintenanceTeams, setMaintenanceTeams] = useState<any[]>([]);

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
    const [expensePaymentMode, setExpensePaymentMode] = useState<'own_account' | 'company_account'>('own_account');
    const [expenseTaxIds, setExpenseTaxIds] = useState<number[]>([]);
    const [expenseAttachments, setExpenseAttachments] = useState<Attachment[]>([]);

    // ── IT Support Form State ──────────────────────────────────────────────────
    const [hdSubject, setHdSubject] = useState('');
    const [hdDescription, setHdDescription] = useState('');
    const [hdTeamId, setHdTeamId] = useState<number | null>(null);
    const [hdUserId, setHdUserId] = useState<number | null>(null);
    const [hdPriority, setHdPriority] = useState<Priority>('0');
    const [hdTypeId, setHdTypeId] = useState<number | null>(null);
    const [hdTagIds, setHdTagIds] = useState<number[]>([]);
    const [hdPartnerName, setHdPartnerName] = useState('');
    const [hdPartnerEmail, setHdPartnerEmail] = useState('');
    const [hdPartnerPhone, setHdPartnerPhone] = useState('');
    const [hdAttachments, setHdAttachments] = useState<Attachment[]>([]);

    // ── Maintenance Form State ─────────────────────────────────────────────────
    const [mntTitle, setMntTitle] = useState('');
    const [mntDescription, setMntDescription] = useState('');
    const [mntCategoryId, setMntCategoryId] = useState<number | null>(null);
    const [mntType, setMntType] = useState<'corrective' | 'preventive'>('corrective');
    const [mntEquipmentId, setMntEquipmentId] = useState<number | null>(null);
    const [mntTeamId, setMntTeamId] = useState<number | null>(null);
    const [mntScheduleDate, setMntScheduleDate] = useState<Date | null>(null);
    const [mntDuration, setMntDuration] = useState('');
    const [mntPriority, setMntPriority] = useState<Priority>('0');
    const [mntAttachments, setMntAttachments] = useState<Attachment[]>([]);

    // ── Attendance Form State ──────────────────────────────────────────────────
    const [attSubType, setAttSubType] = useState<AttSubType>('correction');
    const [attCheckIn, setAttCheckIn] = useState<Date | null>(null);
    const [attCheckOut, setAttCheckOut] = useState<Date | null>(null);
    const [attReason, setAttReason] = useState('');
    const [attOvertimeDate, setAttOvertimeDate] = useState<Date | null>(null);
    const [attOvertimeDuration, setAttOvertimeDuration] = useState('');
    const [attOvertimeReason, setAttOvertimeReason] = useState('');
    const [attJustLeaveTypeId, setAttJustLeaveTypeId] = useState<number | null>(null);
    const [attJustDateFrom, setAttJustDateFrom] = useState<Date | null>(null);
    const [attJustDateTo, setAttJustDateTo] = useState<Date | null>(null);
    const [attJustText, setAttJustText] = useState('');
    const [attAttachments, setAttAttachments] = useState<Attachment[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setDataLoading(true);
        setProductsLoadError(false);
        try {
            const [typesData, productsData, taxesData, teamsData, categoriesData, equipmentData, mntTeamsData, hdTypesData, hdTagsData, hdAgentsData] = await Promise.all([
                apiClient.getTimeOffTypes().catch(() => ({ types: [] as any[] })),
                apiClient.getExpenseProducts().catch(() => ({ products: [] as any[], _error: true })),
                apiClient.getExpenseTaxes().catch(() => ({ taxes: [] as any[] })),
                apiClient.getHelpdeskTeams().catch(() => ({ available: false, teams: [] as any[] })),
                apiClient.getMaintenanceCategories().catch(() => ({ categories: [] as any[] })),
                apiClient.getMaintenanceEquipment().catch(() => ({ equipment: [] as any[] })),
                apiClient.getMaintenanceTeams().catch(() => ({ teams: [] as any[] })),
                apiClient.getHelpdeskTicketTypes().catch(() => ({ types: [] as any[] })),
                apiClient.getHelpdeskTags().catch(() => ({ tags: [] as any[] })),
                apiClient.getHelpdeskAgents().catch(() => ({ agents: [] as any[] })),
            ]);

            const types = (typesData as any).types || [];
            const products = (productsData as any).products || [];
            const taxes = (taxesData as any).taxes || [];
            const categories = (categoriesData as any).categories || [];
            const equipment = (equipmentData as any).equipment || [];
            const mntTeams = (mntTeamsData as any).teams || [];
            const hdTypes = (hdTypesData as any).types || [];
            const hdTags = (hdTagsData as any).tags || [];
            const hdAgents = (hdAgentsData as any).agents || [];

            setLeaveTypes(types);
            setExpenseProducts(products);
            setExpenseTaxes(taxes);
            if ((teamsData as any).available === false) {
                setHelpdeskAvailable(false);
            } else {
                setHelpdeskTeams((teamsData as any).teams || []);
            }
            setMaintenanceCategories(categories);
            setMaintenanceEquipment(equipment);
            setMaintenanceTeams(mntTeams);
            setHelpdeskTicketTypes(hdTypes);
            setHelpdeskTags(hdTags);
            setHelpdeskAgents(hdAgents);

            // Track if expense products failed to load (blocking field)
            if (products.length === 0) {
                setProductsLoadError(true);
            }
        } catch (error) {
            toast.error('Failed to fetch form data. Please check your connection.');
            setProductsLoadError(true);
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
                payment_mode: expensePaymentMode,
                tax_ids: expenseTaxIds.length > 0 ? expenseTaxIds : undefined,
                attachments: expenseAttachments.length > 0 ? expenseAttachments : undefined,
            });
            toast.success('Expense claim submitted!');
            setCurrentView('hub');
            setProductId(null); setAmount(''); setDescription('');
            setDate(null); setExpensePaymentMode('own_account');
            setExpenseTaxIds([]); setExpenseAttachments([]);
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
                user_id: hdUserId ?? undefined,
                priority: hdPriority !== '0' ? hdPriority : undefined,
                ticket_type_id: hdTypeId ?? undefined,
                tag_ids: hdTagIds.length > 0 ? hdTagIds : undefined,
                partner_name: hdPartnerName.trim() || undefined,
                partner_email: hdPartnerEmail.trim() || undefined,
                partner_phone: hdPartnerPhone.trim() || undefined,
                attachments: hdAttachments.length > 0 ? hdAttachments : undefined,
            });
            toast.success('IT support ticket submitted!');
            setCurrentView('hub');
            setHdSubject(''); setHdDescription(''); setHdTeamId(null);
            setHdUserId(null); setHdPriority('0'); setHdTypeId(null);
            setHdTagIds([]); setHdPartnerName(''); setHdPartnerEmail('');
            setHdPartnerPhone(''); setHdAttachments([]);
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
                equipment_id: mntEquipmentId ?? undefined,
                maintenance_team_id: mntTeamId ?? undefined,
                schedule_date: mntScheduleDate ? mntScheduleDate.toISOString() : undefined,
                duration: mntDuration ? parseFloat(mntDuration) : undefined,
                priority: mntPriority !== '0' ? mntPriority : undefined,
                attachments: mntAttachments.length > 0 ? mntAttachments : undefined,
            });
            toast.success('Maintenance request submitted!');
            setCurrentView('hub');
            setMntTitle(''); setMntDescription(''); setMntCategoryId(null);
            setMntType('corrective'); setMntEquipmentId(null); setMntTeamId(null);
            setMntScheduleDate(null); setMntDuration(''); setMntPriority('0');
            setMntAttachments([]);
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit maintenance request');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAttendance = async () => {
        if (!user?.id) { toast.error('User session not found. Please re-login.'); return; }
        setLoading(true);
        try {
            if (attSubType === 'correction') {
                if (!attCheckIn) { toast.warning('Please select a check-in date and time.'); setLoading(false); return; }
                await apiClient.createAttendanceCorrection({
                    employee_id: user.id,
                    check_in: attCheckIn.toISOString(),
                    check_out: attCheckOut ? attCheckOut.toISOString() : undefined,
                    reason: attReason.trim() || undefined,
                    attachments: attAttachments.length > 0 ? attAttachments : undefined,
                });
                toast.success('Attendance correction submitted!');
            } else if (attSubType === 'overtime') {
                if (!attOvertimeDate || !attOvertimeDuration) {
                    toast.warning('Please select a date and enter the overtime hours.');
                    setLoading(false); return;
                }
                await apiClient.createAttendanceOvertime({
                    employee_id: user.id,
                    date: attOvertimeDate.toISOString().split('T')[0],
                    duration: parseFloat(attOvertimeDuration),
                    reason: attOvertimeReason.trim() || undefined,
                });
                toast.success('Overtime request submitted!');
            } else {
                if (!attJustLeaveTypeId || !attJustDateFrom || !attJustDateTo || !attJustText.trim()) {
                    toast.warning('Please fill in all required fields.');
                    setLoading(false); return;
                }
                await apiClient.createAttendanceJustification({
                    employee_id: user.id,
                    leave_type_id: attJustLeaveTypeId,
                    date_from: attJustDateFrom.toISOString().split('T')[0],
                    date_to: attJustDateTo.toISOString().split('T')[0],
                    justification: attJustText.trim(),
                    attachments: attAttachments.length > 0 ? attAttachments : undefined,
                });
                toast.success('Absence justification submitted!');
            }
            setCurrentView('hub');
            setAttCheckIn(null); setAttCheckOut(null); setAttReason('');
            setAttOvertimeDate(null); setAttOvertimeDuration(''); setAttOvertimeReason('');
            setAttJustLeaveTypeId(null); setAttJustDateFrom(null); setAttJustDateTo(null);
            setAttJustText(''); setAttAttachments([]);
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit attendance request');
        } finally {
            setLoading(false);
        }
    };

    // ── Shared UI helpers ──────────────────────────────────────────────────────

    const renderPriorityStars = (
        value: Priority,
        onChange: (v: Priority) => void,
        color: string,
        labels = ['Normal', 'Important', 'Very Urgent', 'Critical']
    ) => (
        <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['0', '1', '2', '3'] as Priority[]).map((p) => (
                <TouchableOpacity key={p} onPress={() => onChange(p)} activeOpacity={0.7}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
                        backgroundColor: value === p ? color + '25' : cardColor }}>
                    <Star size={18} color={value >= p && value !== '0' ? color : muted}
                        fill={value >= p && value !== '0' ? color : 'transparent'} />
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: value === p ? color : muted, marginTop: 4 }}>
                        {labels[parseInt(p)]}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderTagPills = (
        items: any[],
        selected: number[],
        onToggle: (id: number) => void,
        color: string
    ) => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {items.map((item: any) => {
                const isSelected = selected.includes(item.id);
                return (
                    <TouchableOpacity key={item.id} onPress={() => onToggle(item.id)} activeOpacity={0.7}
                        style={{ backgroundColor: isSelected ? color + '25' : cardColor,
                            paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, minWidth: 80, alignItems: 'center' }}>
                        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: isSelected ? color : text }}>
                            {item.name}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );

    // ── Render: Hub ────────────────────────────────────────────────────────────

    const renderHub = () => (
        <View style={{ gap: 16, paddingVertical: 10 }}>
            <View style={{ marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 32, color: text }}>New Request</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted, marginTop: 8 }}>What would you like to submit today?</Text>
            </View>

            {/* Time Off */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => setCurrentView('time-off')}
                style={{ backgroundColor: semanticInfo + '18', borderRadius: 32, padding: 32, overflow: 'hidden', minHeight: 200, justifyContent: 'space-between' }}>
                <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.12, transform: [{ rotate: '15deg' }] }}>
                    <Clock size={160} color={semanticInfo} />
                </View>
                <View style={{ width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticInfo + '28' }}>
                    <Clock size={28} color={semanticInfo} strokeWidth={2} />
                </View>
                <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: semanticInfo, marginBottom: 8 }}>Time Off</Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>Vacation, Sick Leave & More</Text>
                </View>
                <View style={{ position: 'absolute', right: 24, bottom: 24, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticInfo + '28' }}>
                    <ArrowRight size={24} color={semanticInfo} />
                </View>
            </TouchableOpacity>

            {/* Expense */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => setCurrentView('expense')}
                style={{ backgroundColor: semanticSuccess + '18', borderRadius: 32, padding: 32, overflow: 'hidden', minHeight: 200, justifyContent: 'space-between' }}>
                <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.12, transform: [{ rotate: '15deg' }] }}>
                    <DollarSign size={160} color={semanticSuccess} />
                </View>
                <View style={{ width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticSuccess + '28' }}>
                    <DollarSign size={28} color={semanticSuccess} strokeWidth={2} />
                </View>
                <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: semanticSuccess, marginBottom: 8 }}>Expense Claim</Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>Reimbursements & Purchases</Text>
                </View>
                <View style={{ position: 'absolute', right: 24, bottom: 24, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticSuccess + '28' }}>
                    <ArrowRight size={24} color={semanticSuccess} />
                </View>
            </TouchableOpacity>

            {/* Attendance */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => setCurrentView('attendance')}
                style={{ backgroundColor: semanticWarning + '18', borderRadius: 32, padding: 32, overflow: 'hidden', minHeight: 200, justifyContent: 'space-between' }}>
                <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.12, transform: [{ rotate: '15deg' }] }}>
                    <UserCheck size={160} color={semanticWarning} />
                </View>
                <View style={{ width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticWarning + '28' }}>
                    <UserCheck size={28} color={semanticWarning} strokeWidth={2} />
                </View>
                <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: semanticWarning, marginBottom: 8 }}>Attendance</Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>Corrections, Overtime & Absences</Text>
                </View>
                <View style={{ position: 'absolute', right: 24, bottom: 24, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticWarning + '28' }}>
                    <ArrowRight size={24} color={semanticWarning} />
                </View>
            </TouchableOpacity>

            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, paddingHorizontal: 4 }}>More Options</Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Timesheet → dedicated screen */}
                <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(app)/timesheet')}
                    style={{ flex: 1, backgroundColor: semanticSuccess + '18', borderRadius: 28, padding: 24, overflow: 'hidden', minHeight: 160, justifyContent: 'space-between' }}>
                    <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.1 }}>
                        <Timer size={100} color={semanticSuccess} />
                    </View>
                    <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticSuccess + '28' }}>
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
                    style={{ flex: 1, backgroundColor: (helpdeskAvailable ? semanticError : muted) + '18', borderRadius: 28, padding: 24, overflow: 'hidden', minHeight: 160, justifyContent: 'space-between', opacity: helpdeskAvailable ? 1 : 0.5 }}>
                    <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.1 }}>
                        <Monitor size={100} color={semanticError} />
                    </View>
                    <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: (helpdeskAvailable ? semanticError : muted) + '28' }}>
                        <Monitor size={22} color={helpdeskAvailable ? semanticError : muted} />
                    </View>
                    <View>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: helpdeskAvailable ? semanticError : muted, marginBottom: 4 }}>IT Support</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted }}>Report an issue</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Maintenance → inline form */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => setCurrentView('maintenance')}
                style={{ backgroundColor: semanticInfo + '18', borderRadius: 28, padding: 24, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 90 }}>
                <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.09 }}>
                    <Wrench size={100} color={semanticInfo} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticInfo + '28' }}>
                        <Wrench size={24} color={semanticInfo} />
                    </View>
                    <View>
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 22, color: semanticInfo }}>Maintenance</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: muted }}>Equipment & facility issues</Text>
                    </View>
                </View>
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticInfo + '28' }}>
                    <ArrowRight size={20} color={semanticInfo} />
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
                                style={{ backgroundColor: holidayStatusId === type.id ? semanticInfo + '25' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, minWidth: 100, alignItems: 'center' }}>
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
                ) : productsLoadError && expenseProducts.length === 0 ? (
                    <View style={{ backgroundColor: semanticError + '18', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: semanticError, flex: 1 }}>
                            Could not load categories. Tap to retry.
                        </Text>
                        <TouchableOpacity onPress={fetchData} activeOpacity={0.7}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: semanticError + '25', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}>
                            <RefreshCw size={16} color={semanticError} />
                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 13, color: semanticError }}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {expenseProducts.map((prod: any) => (
                            <TouchableOpacity key={prod.id} onPress={() => setProductId(prod.id)} activeOpacity={0.7}
                                style={{ backgroundColor: productId === prod.id ? semanticSuccess + '25' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: productId === prod.id ? semanticSuccess : text }}>{prod.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Paid By</Text>
                <View style={{ flexDirection: 'row', backgroundColor: cardColor, borderRadius: 20, padding: 4 }}>
                    {([['own_account', 'Employee (reimburse)'], ['company_account', 'Company']] as const).map(([val, label]) => (
                        <TouchableOpacity key={val} onPress={() => setExpensePaymentMode(val)} activeOpacity={0.7}
                            style={{ flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center',
                                backgroundColor: expensePaymentMode === val ? semanticSuccess : 'transparent' }}>
                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: expensePaymentMode === val ? '#fff' : muted }}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {expenseTaxes.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Included Taxes (Optional)</Text>
                    {renderTagPills(
                        expenseTaxes.map((t: any) => ({ id: t.id, name: `${t.name} (${t.amount}%)` })),
                        expenseTaxIds,
                        (id) => setExpenseTaxIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]),
                        semanticSuccess
                    )}
                </View>
            )}

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

            <Button size="lg" onPress={handleCreateExpense} disabled={loading || (productsLoadError && expenseProducts.length === 0)}
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
                                style={{ backgroundColor: hdTeamId === team.id ? semanticError + '25' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: hdTeamId === team.id ? semanticError : text }}>{team.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {helpdeskAgents.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Assigned To (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {helpdeskAgents.map((agent: any) => (
                            <TouchableOpacity key={agent.id} onPress={() => setHdUserId(hdUserId === agent.id ? null : agent.id)} activeOpacity={0.7}
                                style={{ backgroundColor: hdUserId === agent.id ? semanticError + '25' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: hdUserId === agent.id ? semanticError : text }}>{agent.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Priority (Optional)</Text>
                {renderPriorityStars(hdPriority, setHdPriority, semanticError)}
            </View>

            {helpdeskTicketTypes.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Type (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {helpdeskTicketTypes.map((t: any) => (
                            <TouchableOpacity key={t.id} onPress={() => setHdTypeId(hdTypeId === t.id ? null : t.id)} activeOpacity={0.7}
                                style={{ backgroundColor: hdTypeId === t.id ? semanticError + '25' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: hdTypeId === t.id ? semanticError : text }}>{t.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {helpdeskTags.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Tags (Optional)</Text>
                    {renderTagPills(helpdeskTags, hdTagIds,
                        (id) => setHdTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]),
                        semanticError
                    )}
                </View>
            )}

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Description (Optional)</Text>
                <Input placeholder="Provide more details about the issue..." value={hdDescription} onChangeText={setHdDescription}
                    containerStyle={{ backgroundColor: cardColor, borderWidth: 0, height: 140, borderRadius: 24, padding: 20 }}
                    inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 }}
                    multiline textAlignVertical="top" />
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Customer Info (Optional)</Text>
                <View style={{ backgroundColor: cardColor, borderRadius: 24, padding: 24, gap: 20 }}>
                    <Input placeholder="Customer Name" value={hdPartnerName} onChangeText={setHdPartnerName}
                        containerStyle={{ borderWidth: 0, backgroundColor: background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}
                        inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: text }} />
                    <Input placeholder="Email" value={hdPartnerEmail} onChangeText={setHdPartnerEmail}
                        keyboardType="email-address" autoCapitalize="none"
                        containerStyle={{ borderWidth: 0, backgroundColor: background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}
                        inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: text }} />
                    <Input placeholder="Phone" value={hdPartnerPhone} onChangeText={setHdPartnerPhone}
                        keyboardType="phone-pad"
                        containerStyle={{ borderWidth: 0, backgroundColor: background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}
                        inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: text }} />
                </View>
            </View>

            <AttachmentPicker attachments={hdAttachments} onChange={setHdAttachments} label="Screenshots" />

            <Button size="lg" onPress={handleCreateHelpdesk} disabled={loading}
                style={{ borderRadius: 20, marginTop: 8, backgroundColor: semanticError, height: 56, shadowColor: semanticError, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 }}>
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
                            style={{ flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: mntType === t ? semanticInfo : 'transparent' }}>
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
                                style={{ backgroundColor: mntCategoryId === cat.id ? semanticInfo + '25' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: mntCategoryId === cat.id ? semanticInfo : text }}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {maintenanceEquipment.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Equipment (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {maintenanceEquipment.map((eq: any) => (
                            <TouchableOpacity key={eq.id} onPress={() => setMntEquipmentId(mntEquipmentId === eq.id ? null : eq.id)} activeOpacity={0.7}
                                style={{ backgroundColor: mntEquipmentId === eq.id ? semanticInfo + '25' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: mntEquipmentId === eq.id ? semanticInfo : text }}>{eq.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {maintenanceTeams.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Team (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {maintenanceTeams.map((team: any) => (
                            <TouchableOpacity key={team.id} onPress={() => setMntTeamId(mntTeamId === team.id ? null : team.id)} activeOpacity={0.7}
                                style={{ backgroundColor: mntTeamId === team.id ? semanticInfo + '25' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, minWidth: 100, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: mntTeamId === team.id ? semanticInfo : text }}>{team.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Priority (Optional)</Text>
                {renderPriorityStars(mntPriority, setMntPriority, semanticInfo)}
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Schedule & Duration (Optional)</Text>
                <View style={{ backgroundColor: cardColor, borderRadius: 24, padding: 24, gap: 20 }}>
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Scheduled Date</Text>
                        <DatePicker value={mntScheduleDate} onChange={setMntScheduleDate} placeholder="Select scheduled date" />
                    </View>
                    <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Duration (hours)</Text>
                        <Input placeholder="e.g. 2.5" value={mntDuration} onChangeText={setMntDuration}
                            keyboardType="numeric"
                            containerStyle={{ borderWidth: 0, backgroundColor: background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}
                            inputStyle={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: text }} />
                    </View>
                </View>
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Description (Optional)</Text>
                <Input placeholder="Provide more details..." value={mntDescription} onChangeText={setMntDescription}
                    containerStyle={{ backgroundColor: cardColor, borderWidth: 0, height: 140, borderRadius: 24, padding: 20 }}
                    inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 }}
                    multiline textAlignVertical="top" />
            </View>

            <AttachmentPicker attachments={mntAttachments} onChange={setMntAttachments} label="Photos of Issue" />

            <Button size="lg" onPress={handleCreateMaintenance} disabled={loading}
                style={{ borderRadius: 20, marginTop: 8, backgroundColor: semanticInfo, height: 56, shadowColor: semanticInfo, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#fff' }}>Submit Request</Text>}
            </Button>
        </View>
    );

    // ── Render: Attendance Form ────────────────────────────────────────────────

    const renderAttendanceForm = () => (
        <View style={{ gap: 32 }}>
            <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text }}>Attendance Request</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>Corrections, overtime & absence justifications</Text>
            </View>

            {/* Sub-type selector */}
            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Request Type</Text>
                <View style={{ flexDirection: 'row', backgroundColor: cardColor, borderRadius: 20, padding: 4 }}>
                    {([
                        ['correction', 'Check-in/out'],
                        ['overtime', 'Overtime'],
                        ['justification', 'Absence'],
                    ] as [AttSubType, string][]).map(([val, label]) => (
                        <TouchableOpacity key={val} onPress={() => setAttSubType(val)} activeOpacity={0.7}
                            style={{ flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center',
                                backgroundColor: attSubType === val ? semanticWarning : 'transparent' }}>
                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 12, color: attSubType === val ? '#fff' : muted }}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Check-in/out Correction */}
            {attSubType === 'correction' && (
                <View style={{ gap: 24 }}>
                    <View style={{ backgroundColor: cardColor, borderRadius: 24, padding: 24, gap: 20 }}>
                        <View style={{ gap: 12 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Check-in Date & Time</Text>
                            <DatePicker value={attCheckIn} onChange={setAttCheckIn} placeholder="Select check-in time" />
                        </View>
                        <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
                        <View style={{ gap: 12 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Check-out Date & Time (Optional)</Text>
                            <DatePicker value={attCheckOut} onChange={setAttCheckOut} placeholder="Select check-out time" />
                        </View>
                    </View>
                    <View style={{ gap: 16 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Reason (Optional)</Text>
                        <Input placeholder="Why is this correction needed?" value={attReason} onChangeText={setAttReason}
                            containerStyle={{ backgroundColor: cardColor, borderWidth: 0, height: 120, borderRadius: 24, padding: 20 }}
                            inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 }}
                            multiline textAlignVertical="top" />
                    </View>
                    <AttachmentPicker attachments={attAttachments} onChange={setAttAttachments} label="Supporting Documents" />
                </View>
            )}

            {/* Overtime Request */}
            {attSubType === 'overtime' && (
                <View style={{ gap: 24 }}>
                    <View style={{ backgroundColor: cardColor, borderRadius: 24, padding: 24, gap: 20 }}>
                        <View style={{ gap: 12 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Date</Text>
                            <DatePicker value={attOvertimeDate} onChange={setAttOvertimeDate} placeholder="Select overtime date" />
                        </View>
                        <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
                        <View style={{ gap: 12 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Overtime Hours</Text>
                            <Input placeholder="e.g. 2.5" value={attOvertimeDuration} onChangeText={setAttOvertimeDuration}
                                keyboardType="numeric"
                                containerStyle={{ borderWidth: 0, backgroundColor: background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}
                                inputStyle={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: text }} />
                        </View>
                    </View>
                    <View style={{ gap: 16 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Reason (Optional)</Text>
                        <Input placeholder="What were you working on?" value={attOvertimeReason} onChangeText={setAttOvertimeReason}
                            containerStyle={{ backgroundColor: cardColor, borderWidth: 0, height: 120, borderRadius: 24, padding: 20 }}
                            inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 }}
                            multiline textAlignVertical="top" />
                    </View>
                </View>
            )}

            {/* Absence Justification */}
            {attSubType === 'justification' && (
                <View style={{ gap: 24 }}>
                    <View style={{ gap: 16 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Leave Type</Text>
                        {dataLoading ? (
                            <View style={{ height: 60, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="small" color={muted} /></View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                                {leaveTypes.map((type: any) => (
                                    <TouchableOpacity key={type.id} onPress={() => setAttJustLeaveTypeId(type.id)} activeOpacity={0.7}
                                        style={{ backgroundColor: attJustLeaveTypeId === type.id ? semanticWarning + '25' : cardColor, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, minWidth: 100, alignItems: 'center' }}>
                                        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: attJustLeaveTypeId === type.id ? semanticWarning : text }}>{type.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                    <View style={{ backgroundColor: cardColor, borderRadius: 24, padding: 24, gap: 20 }}>
                        <View style={{ gap: 12 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>From</Text>
                            <DatePicker value={attJustDateFrom} onChange={setAttJustDateFrom} placeholder="Select start date" />
                        </View>
                        <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
                        <View style={{ gap: 12 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>To</Text>
                            <DatePicker value={attJustDateTo} onChange={setAttJustDateTo} placeholder="Select end date" />
                        </View>
                    </View>
                    <View style={{ gap: 16 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Justification</Text>
                        <Input placeholder="Explain your absence..." value={attJustText} onChangeText={setAttJustText}
                            containerStyle={{ backgroundColor: cardColor, borderWidth: 0, height: 140, borderRadius: 24, padding: 20 }}
                            inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 }}
                            multiline textAlignVertical="top" />
                    </View>
                    <AttachmentPicker attachments={attAttachments} onChange={setAttAttachments} label="Supporting Documents" />
                </View>
            )}

            <Button size="lg" onPress={handleCreateAttendance} disabled={loading}
                style={{ borderRadius: 20, marginTop: 8, backgroundColor: semanticWarning, height: 56, shadowColor: semanticWarning, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 }}>
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
            {currentView === 'attendance' && renderAttendanceForm()}
        </ScrollView>
    );
}
