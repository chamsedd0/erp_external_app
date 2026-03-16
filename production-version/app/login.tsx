import { useState } from 'react';
import { View, TextInput, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Linking } from 'react-native';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { useColor } from '../hooks/useColor';
import { useSession } from '../providers/auth-context';
import { useToast } from '../providers/toast-context';
import { apiClient } from '../api/client';
import { useRouter } from 'expo-router';
import { HR_EMAIL } from '../constants';

export default function Login() {
    const [employeeId, setEmployeeId] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useSession();
    const toast = useToast();
    const router = useRouter();

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const primary = useColor('primary');

    const handleLogin = async () => {
        if (!employeeId || !pin) {
            toast.warning('Please enter both Employee ID and PIN');
            return;
        }

        setLoading(true);
        try {
            const data = await apiClient.login(employeeId, pin);
            await signIn(data.token, data.user);
            router.replace('/(app)/dashboard');
        } catch (error: any) {
            toast.error(error.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: background }}
        >
            <View style={{
                flex: 1,
                justifyContent: 'center',
                paddingHorizontal: 32,
            }}>
                {/* Header */}
                <View style={{ marginBottom: 48, alignItems: 'center' }}>
                    <Text style={{
                        fontSize: 42,
                        fontFamily: 'Outfit_700Bold',
                        color: text,
                        marginBottom: 12,
                    }}>
                        Welcome
                    </Text>
                    <Text style={{
                        fontSize: 17,
                        color: muted,
                        textAlign: 'center',
                    }}>
                        Sign in to access your portal
                    </Text>
                </View>

                {/* Login Form */}
                <View style={{ gap: 20 }}>
                    <View>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: muted,
                            marginBottom: 8,
                        }}>
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
                            }}
                        />
                    </View>

                    <View>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: muted,
                            marginBottom: 8,
                        }}>
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
                            }}
                        />
                    </View>

                    <Button
                        size="lg"
                        onPress={handleLogin}
                        disabled={loading}
                        style={{
                            marginTop: 12,
                            borderRadius: 100,
                        }}
                    >
                        <Text style={{
                            fontFamily: 'Outfit_700Bold',
                            fontSize: 16,
                            color: '#1a1a1a',
                        }}>
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
                                                `mailto:${HR_EMAIL}?subject=PIN%20Reset%20Request`
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
