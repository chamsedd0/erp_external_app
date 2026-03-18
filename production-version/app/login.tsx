import { useState } from 'react';
import { View, TextInput, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { useColor } from '../hooks/useColor';
import { useSession } from '../providers/auth-context';
import { useToast } from '../providers/toast-context';
import { apiClient } from '../api/client';
import { useRouter } from 'expo-router';
import { Building2, X } from 'lucide-react-native';

export default function Login() {
    const [employeeId, setEmployeeId] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);

    // Company setup step
    const [companyCode, setCompanyCode] = useState('');
    const [companyLoading, setCompanyLoading] = useState(false);

    const { signIn, tenantSlug, tenantName, hrEmail, setTenant, clearTenant } = useSession();
    const toast = useToast();
    const router = useRouter();

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const primary = useColor('primary');

    // ── Company Setup Step ────────────────────────────────────────────────────

    const handleCompanyContinue = async () => {
        const slug = companyCode.trim().toLowerCase();
        if (!slug) {
            toast.warning('Please enter your company code');
            return;
        }
        setCompanyLoading(true);
        try {
            const data = await apiClient.getTenantInfo(slug);
            await setTenant(slug, data.name, data.hr_email);
            setCompanyCode('');
        } catch {
            toast.error('Company code not found. Please check with your HR department.');
        } finally {
            setCompanyLoading(false);
        }
    };

    if (!tenantSlug) {
        return (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, backgroundColor: background }}
            >
                <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>
                    {/* Header */}
                    <View style={{ marginBottom: 48, alignItems: 'center' }}>
                        <View style={{
                            width: 72, height: 72, borderRadius: 24,
                            backgroundColor: primary + '20',
                            alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                        }}>
                            <Building2 size={36} color={primary} />
                        </View>
                        <Text style={{ fontSize: 36, fontFamily: 'Outfit_700Bold', color: text, marginBottom: 10 }}>
                            Welcome
                        </Text>
                        <Text style={{ fontSize: 16, color: muted, textAlign: 'center', fontFamily: 'DMSans_400Regular' }}>
                            Enter your company code to get started
                        </Text>
                    </View>

                    {/* Company Code Input */}
                    <View style={{ gap: 16 }}>
                        <View>
                            <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: muted, marginBottom: 8 }}>
                                Company Code
                            </Text>
                            <TextInput
                                value={companyCode}
                                onChangeText={setCompanyCode}
                                placeholder="e.g. acmecorp"
                                placeholderTextColor={muted}
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="go"
                                onSubmitEditing={handleCompanyContinue}
                                style={{
                                    backgroundColor: cardColor,
                                    borderRadius: 100,
                                    paddingHorizontal: 20,
                                    paddingVertical: 16,
                                    fontSize: 16,
                                    color: text,
                                    borderColor: '#ffffff24',
                                    borderWidth: 1,
                                    fontFamily: 'DMSans_400Regular',
                                }}
                            />
                        </View>

                        <Button
                            size="lg"
                            onPress={handleCompanyContinue}
                            disabled={companyLoading}
                            style={{ borderRadius: 100 }}
                        >
                            {companyLoading
                                ? <ActivityIndicator size="small" color="#1a1a1a" />
                                : <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#1a1a1a' }}>
                                    Continue
                                </Text>
                            }
                        </Button>
                    </View>
                </View>
            </KeyboardAvoidingView>
        );
    }

    // ── Login Step ────────────────────────────────────────────────────────────

    const handleLogin = async () => {
        if (!employeeId || !pin) {
            toast.warning('Please enter both Employee ID and PIN');
            return;
        }

        setLoading(true);
        try {
            const data = await apiClient.login(employeeId, pin, tenantSlug);
            await signIn(data.token, data.user);
            router.replace('/(app)/dashboard');
        } catch (error: any) {
            const msg: string = error?.message || '';
            if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed to fetch')) {
                toast.error('Connection error. Please check your internet connection.');
            } else {
                toast.error('Login failed. Please check your Employee ID and PIN.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: background }}
        >
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>
                {/* Company badge */}
                <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 10, marginBottom: 36,
                    backgroundColor: cardColor,
                    paddingHorizontal: 16, paddingVertical: 10,
                    borderRadius: 100, alignSelf: 'center',
                }}>
                    <Building2 size={16} color={primary} />
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: text }}>
                        {tenantName ?? tenantSlug}
                    </Text>
                    <TouchableOpacity onPress={clearTenant} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={14} color={muted} />
                    </TouchableOpacity>
                </View>

                {/* Header */}
                <View style={{ marginBottom: 40, alignItems: 'center' }}>
                    <Text style={{ fontSize: 42, fontFamily: 'Outfit_700Bold', color: text, marginBottom: 12 }}>
                        Sign In
                    </Text>
                    <Text style={{ fontSize: 17, color: muted, textAlign: 'center', fontFamily: 'DMSans_400Regular' }}>
                        Enter your Employee ID and PIN
                    </Text>
                </View>

                {/* Login Form */}
                <View style={{ gap: 20 }}>
                    <View>
                        <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: muted, marginBottom: 8 }}>
                            Employee ID
                        </Text>
                        <TextInput
                            value={employeeId}
                            onChangeText={setEmployeeId}
                            placeholder="Enter your employee ID"
                            placeholderTextColor={muted}
                            autoCapitalize="none"
                            style={{
                                backgroundColor: cardColor,
                                borderRadius: 100,
                                paddingHorizontal: 20,
                                paddingVertical: 16,
                                fontSize: 16,
                                color: text,
                                borderColor: '#ffffff24',
                                borderWidth: 1,
                                fontFamily: 'DMSans_400Regular',
                            }}
                        />
                    </View>

                    <View>
                        <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: muted, marginBottom: 8 }}>
                            PIN
                        </Text>
                        <TextInput
                            value={pin}
                            onChangeText={setPin}
                            placeholder="Enter your PIN"
                            placeholderTextColor={muted}
                            secureTextEntry
                            keyboardType="numeric"
                            style={{
                                backgroundColor: cardColor,
                                borderRadius: 100,
                                paddingHorizontal: 20,
                                paddingVertical: 16,
                                fontSize: 16,
                                color: text,
                                borderColor: '#ffffff24',
                                borderWidth: 1,
                                fontFamily: 'DMSans_400Regular',
                            }}
                        />
                    </View>

                    <Button
                        size="lg"
                        onPress={handleLogin}
                        disabled={loading}
                        style={{ marginTop: 12, borderRadius: 100 }}
                    >
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#1a1a1a' }}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Text>
                    </Button>

                    {/* PIN recovery */}
                    <TouchableOpacity
                        onPress={() =>
                            Alert.alert(
                                'Locked Out?',
                                'To reset your PIN, please contact your HR department.',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Email HR',
                                        onPress: () =>
                                            Linking.openURL(
                                                `mailto:${hrEmail ?? ''}?subject=PIN%20Reset%20Request`
                                            ),
                                    },
                                ]
                            )
                        }
                        style={{ alignItems: 'center', marginTop: 20, paddingVertical: 8 }}
                    >
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted }}>
                            Locked out?{' '}
                            <Text style={{ color: primary, fontFamily: 'DMSans_700Bold' }}>
                                Contact HR
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
