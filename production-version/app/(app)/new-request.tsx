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
    Timer, Monitor, Wrench, UserCheck, Star,
} from 'lucide-react-native';
import { apiClient, type Attachment } from '../../api/client';
import { useSession } from '../../providers/auth-context';
import { useToast } from '../../providers/toast-context';
import { useNavigation, useRouter } from 'expo-router';
import { currencySymbol } from '../../lib/currency';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { DynamicFields, type OdooFieldDef } from '../../components/DynamicFields';
import { t } from '../../lib/i18n';

type ViewState = 'hub' | 'time-off' | 'expense' | 'helpdesk' | 'maintenance' | 'attendance';
type AttSubType = 'correction' | 'overtime' | 'justification';
type Priority = '0' | '1' | '2' | '3';

export default function NewRequest() {
    const { user, currency } = useSession();
    const toast = useToast();
    const router = useRouter();
    const navigation = useNavigation();
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
    const [timeOffCustomFields, setTimeOffCustomFields] = useState<Record<string, OdooFieldDef>>({});
    const [timeOffCustomValues, setTimeOffCustomValues] = useState<Record<string, any>>({});

    // ── Expense Form State ─────────────────────────────────────────────────────
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState<Date | null>(null);
    const [productId, setProductId] = useState<number | null>(null);
    const [expensePaymentMode, setExpensePaymentMode] = useState<'own_account' | 'company_account'>('own_account');
    const [expenseTaxIds, setExpenseTaxIds] = useState<number[]>([]);
    const [expenseAttachments, setExpenseAttachments] = useState<Attachment[]>([]);
    const [analyticAccounts, setAnalyticAccounts] = useState<any[]>([]);
    const [analyticAccountId, setAnalyticAccountId] = useState<number | null>(null);
    const [expenseCustomFields, setExpenseCustomFields] = useState<Record<string, OdooFieldDef>>({});
    const [expenseCustomValues, setExpenseCustomValues] = useState<Record<string, any>>({});

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
    const [hdCustomFields, setHdCustomFields] = useState<Record<string, OdooFieldDef>>({});
    const [hdCustomValues, setHdCustomValues] = useState<Record<string, any>>({});

    // ── Maintenance Form State ─────────────────────────────────────────────────
    const [mntTitle, setMntTitle] = useState('');
    const [mntDescription, setMntDescription] = useState('');
    const [mntCategoryId, setMntCategoryId] = useState<number | null>(null);
    const [mntType, setMntType] = useState<'corrective' | 'preventive'>('corrective');
    const [mntEquipmentId, setMntEquipmentId] = useState<number | null>(null);
    const [mntTeamId, setMntTeamId] = useState<number | null>(null);
    const [mntScheduleDate, setMntScheduleDate] = useState<Date | null>(null);
    const [mntRequestDate, setMntRequestDate] = useState<Date | null>(null);
    const [mntDuration, setMntDuration] = useState('');
    const [mntPriority, setMntPriority] = useState<Priority>('0');
    const [mntAttachments, setMntAttachments] = useState<Attachment[]>([]);
    const [mntCustomFields, setMntCustomFields] = useState<Record<string, OdooFieldDef>>({});
    const [mntCustomValues, setMntCustomValues] = useState<Record<string, any>>({});

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
    const [attCustomFields, setAttCustomFields] = useState<Record<AttSubType, Record<string, OdooFieldDef>>>({
        correction: {},
        overtime: {},
        justification: {},
    });
    const [attCustomValues, setAttCustomValues] = useState<Record<AttSubType, Record<string, any>>>({
        correction: {},
        overtime: {},
        justification: {},
    });

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const visibleTabBarStyle = {
            position: 'absolute' as const,
            bottom: 0,
            borderWidth: 0.1,
            borderColor: 'rgba(255, 255, 255, 0.28)',
            height: 115,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            backgroundColor: cardColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            elevation: 10,
            paddingBottom: 0,
            paddingTop: 15,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
        };

        navigation.setOptions({
            tabBarStyle: currentView === 'hub' ? visibleTabBarStyle : { display: 'none' },
        });

        return () => {
            navigation.setOptions({ tabBarStyle: visibleTabBarStyle });
        };
    }, [navigation, currentView, cardColor]);

    const requestableItems = (items: any[]) => items.filter((item: any) => item?.requestable !== false);

    const fetchData = async () => {
        setDataLoading(true);
        setProductsLoadError(false);
        try {
            const [typesData, productsData, taxesData, teamsData, categoriesData, equipmentData, mntTeamsData, hdTypesData, hdTagsData, hdAgentsData, analyticData, expenseSchemaData, mntSchemaData, timeOffSchemaData, helpdeskSchemaData, attendanceSchemaData] = await Promise.all([
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
                apiClient.getExpenseAnalyticAccounts().catch(() => ({ accounts: [] as any[] })),
                apiClient.getExpenseFormSchema().catch(() => ({ custom_fields: {} as Record<string, any> })),
                apiClient.getMaintenanceFormSchema().catch(() => ({ custom_fields: {} as Record<string, any> })),
                apiClient.getTimeOffFormSchema().catch(() => ({ custom_fields: {} as Record<string, any> })),
                apiClient.getHelpdeskFormSchema().catch(() => ({ custom_fields: {} as Record<string, any> })),
                apiClient.getAttendanceFormSchema().catch(() => ({
                    correction: { custom_fields: {} as Record<string, any> },
                    overtime: { custom_fields: {} as Record<string, any> },
                    justification: { custom_fields: {} as Record<string, any> },
                })),
            ]);

            const types = requestableItems((typesData as any).types || []);
            const products = requestableItems((productsData as any).products || []);
            const taxes = (taxesData as any).taxes || [];
            const categories = (categoriesData as any).categories || [];
            const equipment = (equipmentData as any).equipment || [];
            const mntTeams = requestableItems((mntTeamsData as any).teams || []);
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
            setAnalyticAccounts((analyticData as any).accounts || []);
            setExpenseCustomFields((expenseSchemaData as any).custom_fields || {});
            setMntCustomFields((mntSchemaData as any).custom_fields || {});
            setTimeOffCustomFields((timeOffSchemaData as any).custom_fields || {});
            setHdCustomFields((helpdeskSchemaData as any).custom_fields || {});
            setAttCustomFields({
                correction: (attendanceSchemaData as any).correction?.custom_fields || {},
                overtime: (attendanceSchemaData as any).overtime?.custom_fields || {},
                justification: (attendanceSchemaData as any).justification?.custom_fields || {},
            });

            setProductsLoadError(Boolean((productsData as any)._error));
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
        if (!leaveTypes.some((type: any) => type.id === holidayStatusId)) {
            toast.warning('Please select an available leave type.');
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
                custom_values: Object.keys(timeOffCustomValues).length > 0 ? timeOffCustomValues : undefined,
                attachments: timeOffAttachments.length > 0 ? timeOffAttachments : undefined,
            });
            toast.success('Time off request submitted!');
            setCurrentView('hub');
            setHolidayStatusId(null); setDateFrom(null); setDateTo(null);
            setReason(''); setTimeOffAttachments([]); setTimeOffCustomValues({});
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
        if (!expenseProducts.some((product: any) => product.id === productId)) {
            toast.warning('Please select an available expense category.');
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
                analytic_account_id: analyticAccountId ?? undefined,
                custom_values: Object.keys(expenseCustomValues).length > 0 ? expenseCustomValues : undefined,
                attachments: expenseAttachments.length > 0 ? expenseAttachments : undefined,
            });
            toast.success('Expense claim submitted!');
            setCurrentView('hub');
            setProductId(null); setAmount(''); setDescription('');
            setDate(null); setExpensePaymentMode('own_account');
            setExpenseTaxIds([]); setExpenseAttachments([]);
            setAnalyticAccountId(null); setExpenseCustomValues({});
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
                custom_values: Object.keys(hdCustomValues).length > 0 ? hdCustomValues : undefined,
                attachments: hdAttachments.length > 0 ? hdAttachments : undefined,
            });
            toast.success('IT support ticket submitted!');
            setCurrentView('hub');
            setHdSubject(''); setHdDescription(''); setHdTeamId(null);
            setHdUserId(null); setHdPriority('0'); setHdTypeId(null);
            setHdTagIds([]); setHdPartnerName(''); setHdPartnerEmail('');
            setHdPartnerPhone(''); setHdAttachments([]); setHdCustomValues({});
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
                schedule_date: mntType === 'preventive' && mntScheduleDate ? mntScheduleDate.toISOString() : undefined,
                request_date: mntType === 'corrective' && mntRequestDate ? mntRequestDate.toISOString() : undefined,
                duration: mntDuration ? parseFloat(mntDuration) : undefined,
                priority: mntPriority !== '0' ? mntPriority : undefined,
                custom_values: Object.keys(mntCustomValues).length > 0 ? mntCustomValues : undefined,
                attachments: mntAttachments.length > 0 ? mntAttachments : undefined,
            });
            toast.success('Maintenance request submitted!');
            setCurrentView('hub');
            setMntTitle(''); setMntDescription(''); setMntCategoryId(null);
            setMntType('corrective'); setMntEquipmentId(null); setMntTeamId(null);
            setMntScheduleDate(null); setMntRequestDate(null); setMntDuration(''); setMntPriority('0');
            setMntAttachments([]); setMntCustomValues({});
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
                    custom_values: Object.keys(attCustomValues.correction).length > 0 ? attCustomValues.correction : undefined,
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
                    custom_values: Object.keys(attCustomValues.overtime).length > 0 ? attCustomValues.overtime : undefined,
                });
                toast.success('Overtime request submitted!');
            } else {
                if (!attJustLeaveTypeId || !attJustDateFrom || !attJustDateTo || !attJustText.trim()) {
                    toast.warning('Please fill in all required fields.');
                    setLoading(false); return;
                }
                if (!leaveTypes.some((type: any) => type.id === attJustLeaveTypeId)) {
                    toast.warning('Please select an available leave type.');
                    setLoading(false); return;
                }
                await apiClient.createAttendanceJustification({
                    employee_id: user.id,
                    leave_type_id: attJustLeaveTypeId,
                    date_from: attJustDateFrom.toISOString().split('T')[0],
                    date_to: attJustDateTo.toISOString().split('T')[0],
                    justification: attJustText.trim(),
                    custom_values: Object.keys(attCustomValues.justification).length > 0 ? attCustomValues.justification : undefined,
                    attachments: attAttachments.length > 0 ? attAttachments : undefined,
                });
                toast.success('Absence justification submitted!');
            }
            setCurrentView('hub');
            setAttCheckIn(null); setAttCheckOut(null); setAttReason('');
            setAttOvertimeDate(null); setAttOvertimeDuration(''); setAttOvertimeReason('');
            setAttJustLeaveTypeId(null); setAttJustDateFrom(null); setAttJustDateTo(null);
            setAttJustText(''); setAttAttachments([]);
            setAttCustomValues({ correction: {}, overtime: {}, justification: {} });
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

    // ── Render: Hub ────────────────────────────────────────────────────────────

    const renderHub = () => (
        <View style={{ gap: 16, paddingVertical: 10 }}>
            <View style={{ marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 32, color: text }}>{t('newRequest.title')}</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted, marginTop: 8 }}>{t('newRequest.prompt')}</Text>
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
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: semanticInfo, marginBottom: 8 }}>{t('newRequest.timeOff')}</Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>{t('newRequest.timeOffSub')}</Text>
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
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: semanticSuccess, marginBottom: 8 }}>{t('newRequest.expense')}</Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>{t('newRequest.expenseSub')}</Text>
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
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: semanticWarning, marginBottom: 8 }}>{t('newRequest.attendance')}</Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>{t('newRequest.attendanceSub')}</Text>
                </View>
                <View style={{ position: 'absolute', right: 24, bottom: 24, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticWarning + '28' }}>
                    <ArrowRight size={24} color={semanticWarning} />
                </View>
            </TouchableOpacity>

            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, paddingHorizontal: 4 }}>{t('newRequest.moreOptions')}</Text>

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
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: semanticSuccess, marginBottom: 4 }}>{t('newRequest.timesheet')}</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted }}>{t('newRequest.timesheetSub')}</Text>
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
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: helpdeskAvailable ? semanticError : muted, marginBottom: 4 }}>{t('newRequest.itSupport')}</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted }}>{t('newRequest.itSupportSub')}</Text>
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
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 22, color: semanticInfo }}>{t('newRequest.maintenance')}</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: muted }}>{t('newRequest.maintenanceSub')}</Text>
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
                <SearchableSelect
                    options={leaveTypes.map((type: any) => ({ id: type.id, name: type.name }))}
                    value={holidayStatusId}
                    onChange={(id) => setHolidayStatusId(id as number | null)}
                    loading={dataLoading}
                    placeholder={t('common.select')}
                    searchPlaceholder={t('common.search')}
                    label="Leave Type"
                    accent={semanticInfo}
                />
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

            {Object.keys(timeOffCustomFields).length > 0 && (
                <DynamicFields
                    sourceModel="hr.leave"
                    fields={timeOffCustomFields}
                    values={timeOffCustomValues}
                    onChange={(name, value) => setTimeOffCustomValues(prev => ({ ...prev, [name]: value }))}
                    accent={semanticInfo}
                />
            )}

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
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text }}>{t('expense.title')}</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>{t('expense.subtitle')}</Text>
            </View>

            <View style={{ alignItems: 'center', paddingVertical: 32, backgroundColor: cardColor, borderRadius: 32 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Total Amount</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 48, color: text, marginRight: 4 }}>{currencySymbol(currency)}</Text>
                    <Input placeholder="0.00" value={amount} onChangeText={setAmount}
                        containerStyle={{ borderWidth: 0, backgroundColor: 'transparent', width: 200, paddingHorizontal: 0 }}
                        inputStyle={{ fontFamily: 'Outfit_700Bold', fontSize: 48, color: text, textAlign: 'left', height: 60, padding: 0 }}
                        keyboardType="numeric" />
                </View>
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Category</Text>
                <SearchableSelect
                    options={expenseProducts.map((prod: any) => ({ id: prod.id, name: prod.name, disabled: prod.requestable === false, disabledReason: prod.unavailable_reason }))}
                    value={productId}
                    onChange={(id) => setProductId(id as number | null)}
                    loading={dataLoading}
                    error={
                        productsLoadError && expenseProducts.length === 0
                            ? 'Could not load categories.'
                            : !dataLoading && expenseProducts.length === 0
                                ? 'No expense categories are configured for this company. Contact your administrator.'
                                : undefined
                    }
                    onRetry={fetchData}
                    placeholder={t('common.select')}
                    searchPlaceholder={t('common.search')}
                    label={t('expense.category')}
                    accent={semanticSuccess}
                />
            </View>

            {analyticAccounts.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Analytic Account (Optional)</Text>
                    <SearchableSelect
                        options={analyticAccounts.map((a: any) => ({ id: a.id, name: a.name }))}
                        value={analyticAccountId}
                        onChange={(id) => setAnalyticAccountId(id as number | null)}
                        placeholder="Select analytic account"
                        searchPlaceholder="Search accounts…"
                        label="Analytic Account"
                        accent={semanticSuccess}
                    />
                </View>
            )}

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
                    <SearchableSelect
                        multiple
                        options={expenseTaxes.map((tax: any) => ({ id: tax.id, name: `${tax.name} (${tax.amount}%)` }))}
                        value={expenseTaxIds}
                        onChange={(ids) => setExpenseTaxIds(ids as number[])}
                        placeholder={t('common.select')}
                        searchPlaceholder={t('common.search')}
                        label={t('expense.taxes')}
                        accent={semanticSuccess}
                    />
                </View>
            )}

            {Object.keys(expenseCustomFields).length > 0 && (
                <DynamicFields
                    sourceModel="hr.expense"
                    fields={expenseCustomFields}
                    values={expenseCustomValues}
                    onChange={(n, v) => setExpenseCustomValues((prev) => ({ ...prev, [n]: v }))}
                    accent={semanticSuccess}
                />
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

            <Button size="lg" onPress={handleCreateExpense} disabled={loading || expenseProducts.length === 0}
                style={{ borderRadius: 20, marginTop: 8, backgroundColor: semanticSuccess, height: 56, shadowColor: semanticSuccess, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#fff' }}>{t('expense.submitClaim')}</Text>}
            </Button>
        </View>
    );

    // ── Render: IT Support Form ────────────────────────────────────────────────

    const renderHelpdeskForm = () => (
        <View style={{ gap: 32 }}>
            <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text }}>IT Support Ticket</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>Describe the issue you&apos;re experiencing</Text>
            </View>

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Subject</Text>
                <Input placeholder="e.g. Cannot access company email..." value={hdSubject} onChangeText={setHdSubject}
                    containerStyle={{ backgroundColor: cardColor, borderWidth: 0, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}
                    inputStyle={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: text }} />
            </View>

            {helpdeskTeams.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Team ({t('common.optional')})</Text>
                    <SearchableSelect
                        options={helpdeskTeams.map((team: any) => ({ id: team.id, name: team.name }))}
                        value={hdTeamId}
                        onChange={(id) => setHdTeamId(id as number | null)}
                        placeholder={t('common.select')}
                        searchPlaceholder={t('common.search')}
                        label="Team"
                        accent={semanticError}
                    />
                </View>
            )}

            {helpdeskAgents.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Assigned To ({t('common.optional')})</Text>
                    <SearchableSelect
                        options={helpdeskAgents.map((agent: any) => ({ id: agent.id, name: agent.name }))}
                        value={hdUserId}
                        onChange={(id) => setHdUserId(id as number | null)}
                        placeholder={t('common.select')}
                        searchPlaceholder={t('common.search')}
                        label="Assigned To"
                        accent={semanticError}
                    />
                </View>
            )}

            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Priority (Optional)</Text>
                {renderPriorityStars(hdPriority, setHdPriority, semanticError)}
            </View>

            {helpdeskTicketTypes.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Type ({t('common.optional')})</Text>
                    <SearchableSelect
                        options={helpdeskTicketTypes.map((tt: any) => ({ id: tt.id, name: tt.name }))}
                        value={hdTypeId}
                        onChange={(id) => setHdTypeId(id as number | null)}
                        placeholder={t('common.select')}
                        searchPlaceholder={t('common.search')}
                        label="Type"
                        accent={semanticError}
                    />
                </View>
            )}

            {helpdeskTags.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Tags (Optional)</Text>
                    <SearchableSelect
                        multiple
                        options={helpdeskTags.map((tag: any) => ({ id: tag.id, name: tag.name }))}
                        value={hdTagIds}
                        onChange={(ids) => setHdTagIds(ids as number[])}
                        placeholder={t('common.select')}
                        searchPlaceholder={t('common.search')}
                        label="Tags"
                        accent={semanticError}
                    />
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

            {Object.keys(hdCustomFields).length > 0 && (
                <DynamicFields
                    sourceModel="helpdesk.ticket"
                    fields={hdCustomFields}
                    values={hdCustomValues}
                    onChange={(name, value) => setHdCustomValues(prev => ({ ...prev, [name]: value }))}
                    accent={semanticError}
                />
            )}

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
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text }}>{t('maintenance.title')}</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>{t('maintenance.subtitle')}</Text>
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
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>{t('maintenance.category')} ({t('common.optional')})</Text>
                    <SearchableSelect
                        options={maintenanceCategories.map((cat: any) => ({ id: cat.id, name: cat.name }))}
                        value={mntCategoryId}
                        onChange={(id) => setMntCategoryId(id as number | null)}
                        placeholder={t('common.select')}
                        searchPlaceholder={t('common.search')}
                        label={t('maintenance.category')}
                        accent={semanticInfo}
                    />
                </View>
            )}

            {maintenanceEquipment.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>{t('maintenance.equipment')} ({t('common.optional')})</Text>
                    <SearchableSelect
                        options={maintenanceEquipment.map((eq: any) => ({ id: eq.id, name: eq.name }))}
                        value={mntEquipmentId}
                        onChange={(id) => setMntEquipmentId(id as number | null)}
                        placeholder={t('common.select')}
                        searchPlaceholder={t('common.search')}
                        label={t('maintenance.equipment')}
                        accent={semanticInfo}
                    />
                </View>
            )}

            {maintenanceTeams.length > 0 && (
                <View style={{ gap: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>{t('maintenance.team')} ({t('common.optional')})</Text>
                    <SearchableSelect
                        options={maintenanceTeams.map((team: any) => ({ id: team.id, name: team.name }))}
                        value={mntTeamId}
                        onChange={(id) => setMntTeamId(id as number | null)}
                        placeholder={t('common.select')}
                        searchPlaceholder={t('common.search')}
                        label={t('maintenance.team')}
                        accent={semanticInfo}
                    />
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
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>
                            {mntType === 'preventive' ? 'Scheduled Date' : 'Request Date'}
                        </Text>
                        {mntType === 'preventive' ? (
                            <DatePicker value={mntScheduleDate} onChange={setMntScheduleDate} placeholder="Select scheduled date" />
                        ) : (
                            <DatePicker value={mntRequestDate} onChange={setMntRequestDate} placeholder="Select request date" />
                        )}
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

            {Object.keys(mntCustomFields).length > 0 && (
                <DynamicFields
                    sourceModel="maintenance.request"
                    fields={mntCustomFields}
                    values={mntCustomValues}
                    onChange={(n, v) => setMntCustomValues((prev) => ({ ...prev, [n]: v }))}
                    accent={semanticInfo}
                />
            )}

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
                    {Object.keys(attCustomFields.correction).length > 0 && (
                        <DynamicFields
                            sourceModel="hr.attendance"
                            fields={attCustomFields.correction}
                            values={attCustomValues.correction}
                            onChange={(name, value) => setAttCustomValues(prev => ({ ...prev, correction: { ...prev.correction, [name]: value } }))}
                            accent={semanticWarning}
                        />
                    )}
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
                    {Object.keys(attCustomFields.overtime).length > 0 && (
                        <DynamicFields
                            sourceModel="hr.attendance.overtime"
                            fields={attCustomFields.overtime}
                            values={attCustomValues.overtime}
                            onChange={(name, value) => setAttCustomValues(prev => ({ ...prev, overtime: { ...prev.overtime, [name]: value } }))}
                            accent={semanticWarning}
                        />
                    )}
                </View>
            )}

            {/* Absence Justification */}
            {attSubType === 'justification' && (
                <View style={{ gap: 24 }}>
                    <View style={{ gap: 16 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Leave Type</Text>
                        <SearchableSelect
                            options={leaveTypes.map((type: any) => ({ id: type.id, name: type.name }))}
                            value={attJustLeaveTypeId}
                            onChange={(id) => setAttJustLeaveTypeId(id as number | null)}
                            loading={dataLoading}
                            placeholder={t('common.select')}
                            searchPlaceholder={t('common.search')}
                            label="Leave Type"
                            accent={semanticWarning}
                        />
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
                    {Object.keys(attCustomFields.justification).length > 0 && (
                        <DynamicFields
                            sourceModel="hr.leave"
                            fields={attCustomFields.justification}
                            values={attCustomValues.justification}
                            onChange={(name, value) => setAttCustomValues(prev => ({ ...prev, justification: { ...prev.justification, [name]: value } }))}
                            accent={semanticWarning}
                        />
                    )}
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
            contentContainerStyle={{ padding: 24, paddingBottom: currentView === 'hub' ? 180 : 40, paddingTop: 24 }}
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
