import { View, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { useRouter } from 'expo-router';
import {
    HelpCircle, Mail, KeyRound, ExternalLink,
    ChevronLeft, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import { useState } from 'react';
import { useSession } from '../../providers/auth-context';

const faqs = [
    {
        question: 'How do I request time off?',
        answer: 'Navigate to the New Request screen, select Time Off, choose your leave type, pick your dates, and submit. Your manager will be notified for approval.',
    },
    {
        question: 'How long does approval take?',
        answer: 'Approval times vary by manager availability. Typically requests are reviewed within 24–48 hours. You\'ll receive a push notification once your request is processed.',
    },
    {
        question: 'Can I cancel a pending request?',
        answer: 'Cancellations need to be made directly in Odoo or by contacting HR. Once a request is approved or rejected it cannot be modified through the app.',
    },
    {
        question: 'How do I submit an expense claim?',
        answer: 'Go to New Request, select Expense Claim, fill in the amount, category, description, and date, then attach your receipt and submit.',
    },
    {
        question: 'What expense categories are available?',
        answer: 'Categories are configured by your organisation in Odoo. Contact HR if you need a new category added.',
    },
    {
        question: 'How do I reset my PIN?',
        answer: 'Your PIN is set by HR in the system. Use the "Reset PIN" button below to send HR an email request and they\'ll update it for you.',
    },
];

export default function Help() {
    const router = useRouter();
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const { hrEmail } = useSession();

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const semanticInfo = useColor('semanticInfo' as any);
    const semanticWarning = useColor('semanticWarning' as any);

    const handleEmailSupport = () => {
        Linking.openURL(`mailto:${hrEmail ?? ''}?subject=Support%20Request`);
    };

    const handlePinReset = () => {
        Alert.alert(
            'Reset Your PIN',
            'To reset your PIN, HR will need to update it in the system. Tap below to send them an email request.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Email HR',
                    onPress: () =>
                        Linking.openURL(
                            `mailto:${hrEmail ?? ''}?subject=PIN%20Reset%20Request&body=Hi%2C%20I%20need%20my%20Portal%20PIN%20reset.%20My%20name%20is%3A%20`
                        ),
                },
            ]
        );
    };

    const contactActions = [
        {
            icon: Mail,
            label: 'Email Support',
            sub: `Send a message to HR`,
            color: semanticInfo,
            onPress: handleEmailSupport,
        },
        {
            icon: KeyRound,
            label: 'Reset PIN',
            sub: 'Locked out? Contact HR to recover access',
            color: semanticWarning,
            onPress: handlePinReset,
        },
    ];

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 24, paddingBottom: 140 }}
        >
            {/* Back Button */}
            <TouchableOpacity
                onPress={() => router.back()}
                style={{
                    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
                    backgroundColor: cardColor, paddingHorizontal: 16, paddingVertical: 10,
                    borderRadius: 100, marginBottom: 24,
                }}
            >
                <ChevronLeft size={20} color={text} style={{ marginRight: 4 }} />
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: text }}>Back</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={{ marginBottom: 28 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 32, color: text, marginBottom: 4 }}>
                    Help & Support
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>
                    Find answers or get in touch
                </Text>
            </View>

            {/* ── Contact Actions ───────────────────────────────────────────────── */}
            <View style={{ gap: 14, marginBottom: 36 }}>
                {contactActions.map((action, index) => (
                    <TouchableOpacity
                        key={index}
                        onPress={action.onPress}
                        activeOpacity={0.8}
                        style={{
                            backgroundColor: action.color + '18',
                            borderRadius: 24,
                            padding: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 16,
                        }}
                    >
                        <View style={{
                            width: 52, height: 52, borderRadius: 18,
                            backgroundColor: action.color + '28',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <action.icon size={24} color={action.color} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 17, color: text }}>
                                {action.label}
                            </Text>
                            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted, marginTop: 2 }}>
                                {action.sub}
                            </Text>
                        </View>
                        <View style={{
                            width: 36, height: 36, borderRadius: 18,
                            backgroundColor: action.color + '28',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <ExternalLink size={16} color={action.color} />
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── FAQ Section ───────────────────────────────────────────────────── */}
            <Text style={{
                fontFamily: 'DMSans_500Medium', fontSize: 12, color: muted,
                textTransform: 'uppercase', letterSpacing: 1.2,
                marginBottom: 12, paddingHorizontal: 4,
            }}>
                Frequently Asked Questions
            </Text>

            <View style={{ backgroundColor: cardColor, borderRadius: 24, overflow: 'hidden' }}>
                {faqs.map((faq, index) => (
                    <View key={index}>
                        <TouchableOpacity
                            onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
                            activeOpacity={0.7}
                            style={{ padding: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}
                        >
                            <View style={{
                                width: 32, height: 32, borderRadius: 10,
                                backgroundColor: semanticInfo + '18',
                                alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, marginTop: 2,
                            }}>
                                <HelpCircle size={16} color={semanticInfo} />
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={{
                                    fontFamily: 'Outfit_600SemiBold', fontSize: 16,
                                    color: text, lineHeight: 22,
                                }}>
                                    {faq.question}
                                </Text>
                                {expandedIndex === index && (
                                    <Text style={{
                                        fontFamily: 'DMSans_400Regular', fontSize: 14,
                                        color: muted, lineHeight: 22, marginTop: 10,
                                    }}>
                                        {faq.answer}
                                    </Text>
                                )}
                            </View>

                            <View style={{ flexShrink: 0, paddingTop: 4 }}>
                                {expandedIndex === index
                                    ? <ChevronUp size={18} color={muted} />
                                    : <ChevronDown size={18} color={muted} />
                                }
                            </View>
                        </TouchableOpacity>

                        {index < faqs.length - 1 && (
                            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: 66 }} />
                        )}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}
