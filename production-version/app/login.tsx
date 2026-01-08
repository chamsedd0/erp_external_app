import { useState } from 'react';
import { View, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { useColor } from '../hooks/useColor';
import { useSession } from '../providers/auth-context';
import { useToast } from '../providers/toast-context';
import { apiClient } from '../api/client';
import { useRouter } from 'expo-router';

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
                        fontWeight: 'bold',
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
                                borderRadius: 16,
                                paddingHorizontal: 20,
                                paddingVertical: 16,
                                fontSize: 16,
                                color: text,
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
                                borderRadius: 16,
                                paddingHorizontal: 20,
                                paddingVertical: 16,
                                fontSize: 16,
                                color: text,
                            }}
                        />
                    </View>

                    <Button
                        size="lg"
                        onPress={handleLogin}
                        disabled={loading}
                        style={{
                            marginTop: 12,
                            borderRadius: 16,
                        }}
                    >
                        <Text style={{
                            fontWeight: 'bold',
                            fontSize: 16,
                            color: '#1a1a1a',
                        }}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Text>
                    </Button>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
