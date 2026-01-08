import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ThemeProvider } from '../theme/theme-provider';
import { SessionProvider, useSession } from '../providers/auth-context';
import { ToastProvider } from '../providers/toast-context';
import '../global.css';

function InitialLayout() {
    const { session, isLoading, isNewUser } = useSession();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(app)';
        const inOnboarding = segments[0] === 'onboarding';
        const inLogin = segments[0] === 'login';

        if (!session) {
            // If not logged in and not on login page, redirect to login
            if (!inLogin) {
                router.replace('/login');
            }
        } else {
            // Logged in
            if (isNewUser) {
                // If new user and not on onboarding, redirect to onboarding
                if (!inOnboarding) {
                    router.replace('/onboarding');
                }
            } else {
                // Existing user
                // If on login or onboarding, redirect to dashboard (inside (app))
                if (inLogin || inOnboarding) {
                    router.replace('/(app)/dashboard');
                } else if ((segments[0] as string) !== '(app)') {
                    // If at root or unknown, go to dashboard
                    router.replace('/(app)/dashboard');
                }
            }
        }
    }, [session, isLoading, isNewUser, segments]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                {/* Add a spinner or splash screen here */}
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(app)" />
            <Stack.Screen name="+not-found" />
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <ThemeProvider>
            <SessionProvider>
                <ToastProvider>
                    <InitialLayout />
                </ToastProvider>
            </SessionProvider>
        </ThemeProvider>
    );
}
