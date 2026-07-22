import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useCallback, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { loadStoredLang } from '../lib/i18n';
import { loadThemePreference } from '../lib/theme-preference';
import { ThemeProvider } from '../theme/theme-provider';
import { SessionProvider, useSession } from '../providers/auth-context';
import { ToastProvider } from '../providers/toast-context';
import * as Notifications from 'expo-notifications';
import '../global.css';

// Show notifications as banners even when the app is in the foreground

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

// Android requires an explicit channel for notifications to display (API 26+)
if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
    });
}
import {
    useFonts,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import * as SplashScreen from 'expo-splash-screen';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

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
                <ActivityIndicator size="large" />
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
    const [fontsLoaded] = useFonts({
        DMSans_400Regular,
        DMSans_500Medium,
        DMSans_700Bold,
        Outfit_400Regular,
        Outfit_500Medium,
        Outfit_700Bold,
    });

    const [langLoaded, setLangLoaded] = useState(false);

    useEffect(() => {
        Promise.all([loadStoredLang(), loadThemePreference()]).finally(() => setLangLoaded(true));
    }, []);

    const ready = fontsLoaded && langLoaded;

    const onLayoutRootView = useCallback(async () => {
        if (ready) {
            await SplashScreen.hideAsync();
        }
    }, [ready]);

    if (!ready) {
        return null;
    }

    return (
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <ThemeProvider>
                <SessionProvider>
                    <ToastProvider>
                        <InitialLayout />
                    </ToastProvider>
                </SessionProvider>
            </ThemeProvider>
        </View>
    );
}
