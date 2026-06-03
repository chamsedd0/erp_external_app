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
import { t } from '../lib/i18n';

export default function Login() {
    const [employeeId, setEmployeeId] = useState('');
    const [pin, setPin] = useState('');
    const [mode, setMode] = useState<'login' | 'email' | 'otp' | 'invite'>('login');
    const [activationEmail, setActivationEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);

    // Company setup step
    const [companyCode, setCompanyCode] = useState('');
    const [companyLoading, setCompanyLoading] = useState(false);

    const { signIn, tenantCode, tenantName, hrEmail, setTenant, clearTenant } = useSession();
    const toast = useToast();
    const router = useRouter();

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const primary = useColor('primary');

    // ── Company Setup Step ────────────────────────────────────────────────────

    const handleCompanyContinue = async () => {
        const slug = companyCode.trim().toUpperCase();
        if (!slug) {
            toast.warning(t('auth.warnCompanyCode'));
            return;
        }
        setCompanyLoading(true);
        try {
            const data = await apiClient.getTenantInfo(slug);
            // Store the SP number returned by the server — never the internal slug
            await setTenant(data.subscription_number ?? slug, data.name, data.hr_email);
            setCompanyCode('');
        } catch {
            toast.error(t('auth.errCompanyNotFound'));
        } finally {
            setCompanyLoading(false);
        }
    };

    if (!tenantCode) {
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
                            {t('auth.welcome')}
                        </Text>
                        <Text style={{ fontSize: 16, color: muted, textAlign: 'center', fontFamily: 'DMSans_400Regular' }}>
                            {t('auth.enterCompanyCode')}
                        </Text>
                    </View>

                    {/* Company Code Input */}
                    <View style={{ gap: 16 }}>
                        <View>
                            <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: muted, marginBottom: 8 }}>
                                {t('auth.companyCode')}
                            </Text>
                            <TextInput
                                value={companyCode}
                                onChangeText={setCompanyCode}
                                placeholder={t('auth.companyCodePlaceholder')}
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
                                    {t('auth.continue')}
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
            toast.warning(t('auth.warnEnterBoth'));
            return;
        }

        setLoading(true);
        try {
            const data = await apiClient.login(employeeId, pin, tenantCode);
            await signIn(data.token, data.user);
            router.replace('/(app)/dashboard');
        } catch (error: any) {
            const msg: string = error?.message || '';
            if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed to fetch')) {
                toast.error(t('auth.errConnection'));
            } else {
                toast.error(t('auth.errLoginFailed'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleActivationStart = async () => {
        if (!tenantCode || !activationEmail.trim()) {
            toast.warning(t('auth.warnWorkEmail'));
            return;
        }
        setLoading(true);
        try {
            await apiClient.startActivation(tenantCode, activationEmail.trim());
            setMode('otp');
            toast.success(t('auth.okCheckEmail'));
        } catch (error: any) {
            toast.error(error?.message || t('auth.errStartActivation'));
        } finally {
            setLoading(false);
        }
    };

    const handleActivationVerify = async () => {
        if (!tenantCode || !activationEmail.trim() || !otp.trim() || !pin.trim()) {
            toast.warning(t('auth.warnEmailCodePin'));
            return;
        }
        setLoading(true);
        try {
            const data = await apiClient.verifyActivation(tenantCode, activationEmail.trim(), otp.trim(), pin.trim());
            await signIn(data.token, data.user);
            router.replace('/(app)/dashboard');
        } catch (error: any) {
            toast.error(error?.message || t('auth.errActivationFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleInviteActivation = async () => {
        if (!tenantCode || !inviteCode.trim() || !pin.trim()) {
            toast.warning(t('auth.warnInviteCodePin'));
            return;
        }
        setLoading(true);
        try {
            const data = await apiClient.activateWithInvite(tenantCode, inviteCode.trim(), pin.trim());
            await signIn(data.token, data.user);
            router.replace('/(app)/dashboard');
        } catch (error: any) {
            toast.error(error?.message || t('auth.errInviteFailed'));
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
                        {tenantName ?? tenantCode}
                    </Text>
                    <TouchableOpacity onPress={clearTenant} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={14} color={muted} />
                    </TouchableOpacity>
                </View>

                {/* Header */}
                <View style={{ marginBottom: 40, alignItems: 'center' }}>
                    <Text style={{ fontSize: 42, fontFamily: 'Outfit_700Bold', color: text, marginBottom: 12 }}>
                        {mode === 'login' ? t('auth.signIn') : t('auth.activate')}
                    </Text>
                    <Text style={{ fontSize: 17, color: muted, textAlign: 'center', fontFamily: 'DMSans_400Regular' }}>
                        {mode === 'login'
                            ? t('auth.signInSubtitle')
                            : mode === 'invite'
                                ? t('auth.inviteSubtitle')
                                : t('auth.emailSubtitle')}
                    </Text>
                </View>

                {/* Login Form */}
                <View style={{ gap: 20 }}>
                    {mode === 'login' && <View>
                        <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: muted, marginBottom: 8 }}>
                            {t('auth.employeeIdOrEmail')}
                        </Text>
                        <TextInput
                            value={employeeId}
                            onChangeText={setEmployeeId}
                            placeholder={t('auth.employeeIdPlaceholder')}
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
                    </View>}

                    {(mode === 'email' || mode === 'otp') && <View>
                        <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: muted, marginBottom: 8 }}>
                            {t('auth.workEmail')}
                        </Text>
                        <TextInput
                            value={activationEmail}
                            onChangeText={setActivationEmail}
                            placeholder={t('auth.workEmailPlaceholder')}
                            placeholderTextColor={muted}
                            autoCapitalize="none"
                            keyboardType="email-address"
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
                    </View>}

                    {mode === 'otp' && <View>
                        <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: muted, marginBottom: 8 }}>
                            {t('auth.activationCode')}
                        </Text>
                        <TextInput
                            value={otp}
                            onChangeText={setOtp}
                            placeholder={t('auth.activationCodePlaceholder')}
                            placeholderTextColor={muted}
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
                    </View>}

                    {mode === 'invite' && <View>
                        <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: muted, marginBottom: 8 }}>
                            {t('auth.inviteCode')}
                        </Text>
                        <TextInput
                            value={inviteCode}
                            onChangeText={setInviteCode}
                            placeholder={t('auth.inviteCodePlaceholder')}
                            placeholderTextColor={muted}
                            autoCapitalize="characters"
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
                    </View>}

                    {(mode === 'login' || mode === 'otp' || mode === 'invite') && <View>
                        <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: muted, marginBottom: 8 }}>
                            {mode === 'login' ? t('auth.pin') : t('auth.newPin')}
                        </Text>
                        <TextInput
                            value={pin}
                            onChangeText={setPin}
                            placeholder={t('auth.pinPlaceholder')}
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
                    </View>}

                    <Button
                        size="lg"
                        onPress={mode === 'login' ? handleLogin : mode === 'email' ? handleActivationStart : mode === 'otp' ? handleActivationVerify : handleInviteActivation}
                        disabled={loading}
                        style={{ marginTop: 12, borderRadius: 100 }}
                    >
                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#1a1a1a' }}>
                            {loading ? t('auth.pleaseWait') : mode === 'login' ? t('auth.signIn') : mode === 'email' ? t('auth.sendCode') : t('auth.activate')}
                        </Text>
                    </Button>

                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
                        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'email' : 'login')} style={{ paddingVertical: 6 }}>
                            <Text style={{ color: primary, fontFamily: 'DMSans_700Bold', fontSize: 14 }}>
                                {mode === 'login' ? t('auth.firstTime') : t('auth.backToSignIn')}
                            </Text>
                        </TouchableOpacity>
                        {mode !== 'login' && (
                            <TouchableOpacity onPress={() => setMode('invite')} style={{ paddingVertical: 6 }}>
                                <Text style={{ color: muted, fontFamily: 'DMSans_500Medium', fontSize: 14 }}>
                                    {t('auth.useInviteCode')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* PIN recovery */}
                    <TouchableOpacity
                        onPress={() =>
                            Alert.alert(
                                t('auth.lockedOutTitle'),
                                t('auth.lockedOutBody'),
                                [
                                    { text: t('common.cancel'), style: 'cancel' },
                                    {
                                        text: t('auth.emailHr'),
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
                            {t('auth.lockedOut')}{' '}
                            <Text style={{ color: primary, fontFamily: 'DMSans_700Bold' }}>
                                {t('auth.contactHr')}
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
