import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Text } from '../../components/ui/text';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { DatePicker } from '../../components/ui/date-picker';
import { useColor } from '../../hooks/useColor';
import { Clock, DollarSign, ChevronLeft, Upload, Calendar, ArrowRight, FileText } from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { useSession } from '../../providers/auth-context';
import { useToast } from '../../providers/toast-context';

type ViewState = 'hub' | 'time-off' | 'expense';

const { width } = Dimensions.get('window');

export default function NewRequest() {
    const { session, user } = useSession();
    const toast = useToast();
    const [currentView, setCurrentView] = useState<ViewState>('hub');
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);

    // Data State
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [expenseProducts, setExpenseProducts] = useState<any[]>([]);

    // Colors
    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const semanticSuccess = useColor('semanticSuccess' as any);
    const semanticWarning = useColor('semanticWarning' as any);
    const semanticError = useColor('semanticError' as any);
    const semanticInfo = useColor('semanticInfo' as any);
    const cardColor = useColor('card');
    const primary = useColor('primary');

    // Time Off Form State
    const [holidayStatusId, setHolidayStatusId] = useState<number | null>(null);
    const [dateFrom, setDateFrom] = useState<Date | null>(null);
    const [dateTo, setDateTo] = useState<Date | null>(null);
    const [reason, setReason] = useState('');

    // Expense Form State
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState<Date | null>(null);
    const [productId, setProductId] = useState<number | null>(null);


    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setDataLoading(true);
        try {
            const [typesData, productsData] = await Promise.all([
                apiClient.getTimeOffTypes(),
                apiClient.getExpenseProducts()
            ]);
            setLeaveTypes(typesData.types || []);
            setExpenseProducts(productsData.products || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch form data. Please check your connection.');
        } finally {
            setDataLoading(false);
        }
    };

    const handleCreateTimeOff = async () => {
        if (!holidayStatusId || !dateFrom || !dateTo) {
            toast.warning('Please select a leave type and dates.');
            return;
        }
        if (!user?.id) {
            toast.error('User session not found. Please re-login.');
            return;
        }

        setLoading(true);
        try {
            await apiClient.createTimeOffRequest({
                employee_id: user.id,
                holiday_status_id: holidayStatusId,
                date_from: dateFrom.toISOString().split('T')[0],
                date_to: dateTo.toISOString().split('T')[0],
                name: reason
            });
            toast.success('Time off request submitted!');
            setCurrentView('hub');
            // Reset form
            setHolidayStatusId(null);
            setDateFrom(null);
            setDateTo(null);
            setReason('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateExpense = async () => {
        if (!productId || !amount || !description || !date) {
            toast.warning('Please fill in all fields.');
            return;
        }
        if (!user?.id) {
            toast.error('User session not found. Please re-login.');
            return;
        }

        setLoading(true);
        try {
            await apiClient.createExpense({
                employee_id: user.id,
                product_id: productId,
                name: description,
                unit_amount: parseFloat(amount),
                quantity: 1,
                date: date.toISOString().split('T')[0]
            });
            toast.success('Expense claim submitted!');
            setCurrentView('hub');
            // Reset form
            setProductId(null);
            setAmount('');
            setDescription('');
            setDate(null);
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit expense');
        } finally {
            setLoading(false);
        }
    };

    const renderHub = () => (
        <View style={{ gap: 24, paddingVertical: 10 }}>
            <View>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 32, color: text }}>
                    New Request
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted, marginTop: 8 }}>
                    What would you like to submit today?
                </Text>
            </View>

            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setCurrentView('time-off')}
                style={{
                    backgroundColor: 'transparent',
                    borderRadius: 32,
                    padding: 32,
                    borderWidth: 1,
                    borderColor: semanticInfo,

                    overflow: 'hidden',
                    minHeight: 200,
                    justifyContent: 'space-between'
                }}
            >
                <View style={{
                    width: 56, height: 56, borderRadius: 20,
                    backgroundColor: 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: semanticInfo
                }}>
                    <Clock size={28} color={semanticInfo} strokeWidth={2} />
                </View>

                <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.1, transform: [{ rotate: '15deg' }] }}>
                    <Clock size={160} color={semanticInfo} strokeWidth={2} />
                </View>

                <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: semanticInfo, marginBottom: 8 }}>
                        Time Off
                    </Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>
                        Vacation, Sick Leave & More
                    </Text>
                </View>

                <View style={{
                    position: 'absolute', right: 24, bottom: 24,
                    width: 48, height: 48, borderRadius: 24,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: semanticInfo,
                }}>
                    <ArrowRight size={24} color={semanticInfo} />
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setCurrentView('expense')}
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 32,
                    padding: 32,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.28)',

                    overflow: 'hidden',
                    minHeight: 200,
                    justifyContent: 'space-between'
                }}
            >
                <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.1, transform: [{ rotate: '15deg' }] }}>
                    <DollarSign size={160} color={semanticSuccess} />
                </View>

                <View style={{
                    width: 56, height: 56, borderRadius: 20,
                    backgroundColor: 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: semanticSuccess
                }}>
                    <DollarSign size={28} color={semanticSuccess} strokeWidth={2} />
                </View>

                <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: semanticSuccess, marginBottom: 8 }}>
                        Expense Claim
                    </Text>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>
                        Reimbursements & Purchases
                    </Text>
                </View>

                <View style={{
                    position: 'absolute', right: 24, bottom: 24,
                    width: 48, height: 48, borderRadius: 24,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: semanticSuccess
                }}>
                    <ArrowRight size={24} color={semanticSuccess} />
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderTimeOffForm = () => (
        <View style={{ gap: 32 }}>
            <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text }}>New Time Off</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>Please fill in the details below</Text>
            </View>

            {/* Leave Type Section */}
            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Leave Type</Text>
                {dataLoading ? (
                    <View style={{ height: 100, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="small" color={muted} />
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 12 }}
                    >
                        {leaveTypes.map((type: any) => (
                            <TouchableOpacity
                                key={type.id}
                                onPress={() => setHolidayStatusId(type.id)}
                                activeOpacity={0.7}
                                style={{
                                    backgroundColor: holidayStatusId === type.id ? 'transparent' : cardColor,
                                    paddingHorizontal: 20,
                                    paddingVertical: 14,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: holidayStatusId === type.id ? semanticInfo : 'transparent',
                                    shadowColor: holidayStatusId === type.id ? semanticInfo : '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: holidayStatusId === type.id ? 0.3 : 0.03,
                                    shadowRadius: 8,
                                    elevation: holidayStatusId === type.id ? 4 : 2,
                                    minWidth: 100,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{
                                    fontFamily: 'DMSans_700Bold',
                                    fontSize: 15,
                                    color: holidayStatusId === type.id ? semanticInfo : text
                                }}>
                                    {type.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Duration Section */}
            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Duration</Text>
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
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>From</Text>
                        <DatePicker
                            value={dateFrom}
                            onChange={setDateFrom}
                            placeholder="Select start date"
                        />
                    </View>
                    <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>To</Text>
                        <DatePicker
                            value={dateTo}
                            onChange={setDateTo}
                            placeholder="Select end date"
                        />
                    </View>
                </View>
            </View>

            {/* Reason Section */}
            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Reason (Optional)</Text>
                <Input
                    placeholder="Add a note for your manager..."
                    value={reason}
                    onChangeText={setReason}
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

            {/* Submit Button */}
            <Button
                size="lg"
                onPress={handleCreateTimeOff}
                disabled={loading}
                style={{
                    borderRadius: 20,
                    marginTop: 8,
                    backgroundColor: semanticInfo,
                    height: 56,
                    shadowColor: semanticInfo,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                    elevation: 6,
                }}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#fff' }}>Submit Request</Text>}
            </Button>
        </View>
    );

    const renderExpenseForm = () => (
        <View style={{ gap: 32 }}>
            <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text }}>New Expense</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>Enter the amount and details</Text>
            </View>

            {/* Amount Input - Hero Section */}
            <View style={{
                alignItems: 'center',
                paddingVertical: 32,
                backgroundColor: cardColor,
                borderRadius: 32,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.05,
                shadowRadius: 24,
                elevation: 4,
            }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Total Amount</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 48, color: text, marginRight: 4 }}>$</Text>
                    <Input
                        placeholder="0.00"
                        value={amount}
                        onChangeText={setAmount}
                        containerStyle={{ borderWidth: 0, backgroundColor: 'transparent', width: 200, paddingHorizontal: 0 }}
                        inputStyle={{ fontFamily: 'Outfit_700Bold', fontSize: 48, color: text, textAlign: 'left', height: 60, padding: 0 }}
                        keyboardType="numeric"
                    />
                </View>
            </View>

            {/* Category Section */}
            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Category</Text>
                {dataLoading ? (
                    <View style={{ height: 100, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="small" color={muted} />
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 12 }}
                    >
                        {expenseProducts.map((prod: any) => (
                            <TouchableOpacity
                                key={prod.id}
                                onPress={() => setProductId(prod.id)}
                                activeOpacity={0.7}
                                style={{
                                    backgroundColor: productId === prod.id ? 'transparent' : cardColor,
                                    paddingHorizontal: 20,
                                    paddingVertical: 14,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: productId === prod.id ? semanticSuccess : 'transparent',
                                    shadowColor: productId === prod.id ? semanticSuccess : '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: productId === prod.id ? 0.3 : 0.03,
                                    shadowRadius: 8,
                                    elevation: productId === prod.id ? 4 : 2,
                                    minWidth: 100,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{
                                    fontFamily: 'DMSans_700Bold',
                                    fontSize: 15,
                                    color: productId === prod.id ? semanticSuccess : text
                                }}>
                                    {prod.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Details Section */}
            <View style={{ gap: 16 }}>
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
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Description</Text>
                        <Input
                            placeholder="What is this expense for?"
                            value={description}
                            onChangeText={setDescription}
                            containerStyle={{
                                borderWidth: 0,
                                backgroundColor: background,
                                borderRadius: 16,
                                paddingHorizontal: 16,
                                paddingVertical: 14,
                            }}
                            inputStyle={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: text }}
                        />
                    </View>
                    <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text }}>Date</Text>
                        <DatePicker
                            value={date}
                            onChange={setDate}
                            placeholder="Select date"
                        />
                    </View>
                </View>
            </View>

            {/* Receipt Upload */}
            <View style={{ gap: 16 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Receipt</Text>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                        borderStyle: 'dashed',
                        borderWidth: 2,
                        borderColor: 'rgba(0,0,0,0.1)',
                        borderRadius: 24,
                        height: 120,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: cardColor,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <View style={{
                            width: 48,
                            height: 48,
                            borderRadius: 16,
                            backgroundColor: background,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Upload size={24} color={muted} />
                        </View>
                        <View>
                            <Text style={{ fontFamily: 'DMSans_700Bold', color: text, fontSize: 16, marginBottom: 4 }}>Upload Receipt</Text>
                            <Text style={{ fontFamily: 'DMSans_400Regular', color: muted, fontSize: 13 }}>Tap to select file</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <Button
                size="lg"
                onPress={handleCreateExpense}
                disabled={loading}
                style={{
                    borderRadius: 20,
                    marginTop: 8,
                    backgroundColor: semanticSuccess,
                    height: 56,
                    shadowColor: semanticSuccess,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                    elevation: 6,
                }}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#fff' }}>Submit Claim</Text>}
            </Button>
        </View>
    );

    return (
        <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ padding: 24, paddingBottom: 180, paddingTop: 24 }}>
            {currentView !== 'hub' && (
                <TouchableOpacity
                    onPress={() => setCurrentView('hub')}
                    style={{
                        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
                        backgroundColor: cardColor, paddingHorizontal: 16, paddingVertical: 10,
                        borderRadius: 100, marginBottom: 24,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
                    }}
                >
                    <ChevronLeft size={20} color={text} style={{ marginRight: 4 }} />
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: text }}>Back</Text>
                </TouchableOpacity>
            )}

            {currentView === 'hub' && renderHub()}
            {currentView === 'time-off' && renderTimeOffForm()}
            {currentView === 'expense' && renderExpenseForm()}
        </ScrollView>
    );
}
