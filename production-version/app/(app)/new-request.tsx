import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { DatePicker } from '../../components/ui/date-picker';
import { useColor } from '../../hooks/useColor';
import { Clock, DollarSign, ChevronLeft, Upload } from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { useSession } from '../../providers/auth-context';
import { useToast } from '../../providers/toast-context';

type ViewState = 'hub' | 'time-off' | 'expense';

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
    const pastelPurple = useColor('pastelPurple' as any);
    const pastelBlue = useColor('pastelBlue' as any);
    const cardColor = useColor('card');

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
        <View style={{ gap: 20 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: text, marginBottom: 10 }}>
                What would you like to request?
            </Text>

            <TouchableOpacity onPress={() => setCurrentView('time-off')}>
                <View style={{ backgroundColor: pastelPurple, borderRadius: 24, padding: 24, paddingVertical: 32, flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.3)', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={32} color="#d3d3d3ff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#d3d3d3ff' }}>Time Off</Text>
                        <Text style={{ fontSize: 16, color: '#d3d3d3ff', opacity: 0.7 }}>Vacation, Sick Leave, etc.</Text>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setCurrentView('expense')}>
                <View style={{ backgroundColor: pastelBlue, borderRadius: 24, padding: 24, paddingVertical: 32, flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.3)', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign size={32} color="#d3d3d3ff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#d3d3d3ff' }}>Expense Claim</Text>
                        <Text style={{ fontSize: 16, color: '#d3d3d3ff', opacity: 0.7 }}>Reimbursements, Travel, etc.</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderTimeOffForm = () => (
        <View style={{ gap: 32 }}>
            {/* Leave Type Section */}
            <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: text, marginBottom: 4 }}>Leave Type</Text>
                {dataLoading ? (
                    <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" />
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
                    >
                        {leaveTypes.map((type: any) => (
                            <TouchableOpacity
                                key={type.id}
                                onPress={() => setHolidayStatusId(type.id)}
                                style={{
                                    backgroundColor: holidayStatusId === type.id ? pastelPurple : cardColor,
                                    paddingHorizontal: 24,
                                    paddingVertical: 16,
                                    borderRadius: 20,
                                    borderWidth: 2,
                                    borderColor: holidayStatusId === type.id ? pastelPurple : 'transparent',
                                    shadowColor: holidayStatusId === type.id ? '#000' : 'transparent',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 8,
                                    elevation: holidayStatusId === type.id ? 4 : 0,
                                }}
                            >
                                <Text style={{
                                    fontWeight: '700',
                                    fontSize: 16,
                                    color: holidayStatusId === type.id ? '#1a1a1a' : text
                                }}>
                                    {type.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Date Range Section */}
            <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: text, marginBottom: 4 }}>Duration</Text>
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
                    <View style={{ gap: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: muted }}>Start Date</Text>
                        <DatePicker
                            value={dateFrom}
                            onChange={setDateFrom}
                            placeholder="Select start date"
                        />
                    </View>
                    <View style={{ gap: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: muted }}>End Date</Text>
                        <DatePicker
                            value={dateTo}
                            onChange={setDateTo}
                            placeholder="Select end date"
                        />
                    </View>
                </View>
            </View>

            {/* Reason Section */}
            <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: text, marginBottom: 4 }}>Reason (Optional)</Text>
                <View style={{
                    backgroundColor: cardColor,
                    borderRadius: 24,
                    padding: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                }}>
                    <Input
                        placeholder="Add a note about your request..."
                        value={reason}
                        onChangeText={setReason}
                        containerStyle={{
                            borderWidth: 2,
                            borderColor: reason ? pastelPurple : 'rgba(0,0,0,0.05)',
                            backgroundColor: background,
                            height: 120,
                            borderRadius: 16,
                        }}
                        inputStyle={{ fontSize: 16, fontWeight: '500' }}
                        multiline
                        textAlignVertical="top"
                    />
                </View>
            </View>

            {/* Submit Button */}
            <Button
                size="lg"
                onPress={handleCreateTimeOff}
                disabled={loading}
                style={{ borderRadius: 20, marginTop: 8 }}
            >
                {loading ? <ActivityIndicator color="#1a1a1a" /> : <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#1a1a1a' }}>Submit Request</Text>}
            </Button>
        </View>
    );

    const renderExpenseForm = () => (
        <View style={{ gap: 32 }}>
            {/* Amount Input - Hero Section */}
            <View style={{
                alignItems: 'center',
                paddingVertical: 24,
                backgroundColor: cardColor,
                borderRadius: 32,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 4,
            }}>
                <Text style={{ fontSize: 16, color: muted, marginBottom: 16, fontWeight: '600' }}>Total Amount</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 56, fontWeight: 'bold', color: text, letterSpacing: -2 }}>$</Text>
                    <Input
                        placeholder="0.00"
                        value={amount}
                        onChangeText={setAmount}
                        containerStyle={{ borderWidth: 0, backgroundColor: 'transparent', width: 180 }}
                        inputStyle={{ fontSize: 56, fontWeight: 'bold', color: text, textAlign: 'center', letterSpacing: -2 }}
                        keyboardType="numeric"
                    />
                </View>
            </View>

            {/* Category Section */}
            <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: text, marginBottom: 4 }}>Category</Text>
                {dataLoading ? (
                    <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" />
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
                    >
                        {expenseProducts.map((prod: any) => (
                            <TouchableOpacity
                                key={prod.id}
                                onPress={() => setProductId(prod.id)}
                                style={{
                                    backgroundColor: productId === prod.id ? pastelBlue : cardColor,
                                    paddingHorizontal: 24,
                                    paddingVertical: 16,
                                    borderRadius: 20,
                                    borderWidth: 2,
                                    borderColor: productId === prod.id ? pastelBlue : 'transparent',
                                    shadowColor: productId === prod.id ? '#000' : 'transparent',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 8,
                                    elevation: productId === prod.id ? 4 : 0,
                                }}
                            >
                                <Text style={{
                                    fontWeight: '700',
                                    fontSize: 16,
                                    color: productId === prod.id ? '#1a1a1a' : text
                                }}>
                                    {prod.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Details Section */}
            <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: text, marginBottom: 4 }}>Details</Text>
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
                    <View style={{ gap: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: muted }}>Description</Text>
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
                            inputStyle={{ fontSize: 16, fontWeight: '500', color: text }}
                        />
                    </View>
                    <View style={{ gap: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: muted }}>Date</Text>
                        <DatePicker
                            value={date}
                            onChange={setDate}
                            placeholder="Select date"
                        />
                    </View>
                </View>
            </View>

            {/* Receipt Upload */}
            <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: text, marginBottom: 4 }}>Receipt</Text>
                <TouchableOpacity style={{
                    borderStyle: 'dashed',
                    borderWidth: 3,
                    borderColor: muted,
                    borderRadius: 24,
                    height: 140,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: cardColor,
                }}>
                    <View style={{ alignItems: 'center', gap: 12 }}>
                        <View style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: background,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Upload size={28} color={muted} />
                        </View>
                        <Text style={{ color: text, fontWeight: '600', fontSize: 16 }}>Upload Receipt</Text>
                        <Text style={{ color: muted, fontSize: 13 }}>Tap to attach a file</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <Button
                size="lg"
                onPress={handleCreateExpense}
                disabled={loading}
                style={{ borderRadius: 20, marginTop: 8 }}
            >
                {loading ? <ActivityIndicator color="#1a1a1a" /> : <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#1a1a1a' }}>Submit Claim</Text>}
            </Button>
        </View>
    );

    return (
        <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ padding: 24, paddingBottom: 180 }}>


            <View style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
                {currentView !== 'hub' && (
                    <TouchableOpacity onPress={() => setCurrentView('hub')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 0 }}>
                        <ChevronLeft size={24} color={text} />
                    </TouchableOpacity>
                )}
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: text }}>
                    {currentView === 'hub' ? 'New Request' : currentView === 'time-off' ? 'Time Off Request' : 'Expense Claim'}
                </Text>
            </View>

            {currentView === 'hub' && renderHub()}
            {currentView === 'time-off' && renderTimeOffForm()}
            {currentView === 'expense' && renderExpenseForm()}
        </ScrollView>
    );
}
