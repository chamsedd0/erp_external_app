import { View, ScrollView, TouchableOpacity, Linking, RefreshControl, Alert } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { HelpCircle, Mail, MessageCircle, ExternalLink, KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { HR_EMAIL } from '../../constants';

const faqs = [
    {
        question: 'How do I request time off?',
        answer: 'Navigate to the New Request screen from the dashboard, select Time Off, choose your leave type, dates, and submit. Your manager will be notified for approval.',
    },
    {
        question: 'How long does approval take?',
        answer: 'Approval times vary by manager availability. Typically, requests are reviewed within 24-48 hours. You\'ll receive a notification once your request is processed.',
    },
    {
        question: 'Can I cancel a pending request?',
        answer: 'Yes, you can cancel pending requests from the request details screen. Once approved or rejected, requests cannot be canceled.',
    },
    {
        question: 'How do I submit an expense claim?',
        answer: 'Go to New Request, select Expense Claim, fill in the amount, category, description, date, and attach your receipt. Submit for processing.',
    },
    {
        question: 'What expense categories are available?',
        answer: 'Available categories include Travel, Meals, Office Supplies, and others as configured by your organization. Contact HR if you need a new category.',
    },
];

export default function Help() {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const pastelPurple = useColor('pastelPurple' as any);
    const pastelBlue = useColor('pastelBlue' as any);

    const handleContactSupport = () => {
        Linking.openURL(`mailto:${HR_EMAIL}?subject=Support%20Request`);
    };

    const handlePinReset = () => {
        Alert.alert(
            'Reset Your PIN',
            'To reset your PIN, your HR department will need to update it in the system. Tap below to send them a request.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Email HR',
                    onPress: () =>
                        Linking.openURL(`mailto:${HR_EMAIL}?subject=PIN%20Reset%20Request&body=Hi%2C%20I%20need%20my%20Portal%20PIN%20reset.%20My%20name%20is%3A%20`),
                },
            ]
        );
    };

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
    };

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 24, paddingBottom: 180 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header */}
            <View style={{ marginBottom: 32 }}>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: text, marginBottom: 8 }}>
                    Help & Support
                </Text>
                <Text style={{ fontSize: 15, color: muted }}>
                    Find answers to common questions
                </Text>
            </View>

            {/* Contact Cards */}
            <View style={{ gap: 12, marginBottom: 32 }}>
                <TouchableOpacity
                    onPress={handleContactSupport}
                    style={{
                        backgroundColor: '#ffffff12',
                        borderRadius: 24,
                        padding: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 16,
                        borderWidth: 1,
                        borderColor: '#ffffff27',
                    }}
                >
                    <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: '#ffffff27',
                        backgroundColor: '#ffffff12',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Mail size={24} color="#ffffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: '#ffffffff', marginBottom: 2 }}>
                            Email Support
                        </Text>
                        <Text style={{ fontSize: 14, color: '#ffffffff', opacity: 0.7 }}>
                            Get help via email
                        </Text>
                    </View>
                    <ExternalLink size={20} color="#ffffffff" opacity={0.5} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleContactSupport}
                    style={{
                        backgroundColor: '#ffffff12',
                        borderRadius: 24,
                        padding: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 16,
                        borderWidth: 1,
                        borderColor: '#ffffff27',
                    }}
                >
                    <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: '#ffffff27',
                        backgroundColor: '#ffffff12',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <MessageCircle size={24} color="#ffffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: '#ffffffff', marginBottom: 2 }}>
                            Live Chat
                        </Text>
                        <Text style={{ fontSize: 14, color: '#ffffffff', opacity: 0.7 }}>
                            Chat with our team
                        </Text>
                    </View>
                    <ExternalLink size={20} color="#ffffffff" opacity={0.5} />
                </TouchableOpacity>

                {/* PIN Reset */}
                <TouchableOpacity
                    onPress={handlePinReset}
                    style={{
                        backgroundColor: '#ffffff12',
                        borderRadius: 24,
                        padding: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 16,
                        borderWidth: 1,
                        borderColor: '#ffffff27',
                    }}
                >
                    <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: '#ffffff27',
                        backgroundColor: '#ffffff12',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <KeyRound size={24} color="#ffffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: '#ffffffff', marginBottom: 2 }}>
                            Reset PIN
                        </Text>
                        <Text style={{ fontSize: 14, color: '#ffffffff', opacity: 0.7 }}>
                            Locked out? Contact HR to reset
                        </Text>
                    </View>
                    <ExternalLink size={20} color="#ffffffff" opacity={0.5} />
                </TouchableOpacity>
            </View>

            {/* FAQ Section */}
            <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: text, marginBottom: 16 }}>
                    Frequently Asked Questions
                </Text>

                {faqs.map((faq, index) => (
                    <TouchableOpacity
                        key={index}
                        onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
                        style={{
                            backgroundColor: cardColor,
                            borderRadius: 16,
                            padding: 20,
                            marginBottom: 12,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.05,
                            shadowRadius: 8,
                            elevation: 2,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                            <HelpCircle size={20} color={muted} style={{ marginTop: 2 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginBottom: 4 }}>
                                    {faq.question}
                                </Text>
                                {expandedIndex === index && (
                                    <Text style={{ fontSize: 14, color: muted, lineHeight: 20, marginTop: 8 }}>
                                        {faq.answer}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            {/* App Info */}
            <View style={{
                backgroundColor: cardColor,
                borderRadius: 20,
                padding: 20,
                alignItems: 'center',
            }}>
                <Text style={{ fontSize: 13, color: muted, marginBottom: 4 }}>App Version</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: text }}>1.0.0</Text>
            </View>
        </ScrollView>
    );
}
