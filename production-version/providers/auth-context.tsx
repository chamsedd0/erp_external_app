import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from '../api/client';

interface AuthContextType {
    signIn: (token: string, user: any) => Promise<void>;
    signOut: () => Promise<void>;
    session: string | null;
    user: any | null;
    isLoading: boolean;
    isNewUser: boolean;
    completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    signIn: async () => { },
    signOut: async () => { },
    session: null,
    user: null,
    isLoading: true,
    isNewUser: false,
    completeOnboarding: async () => { },
});

export function useSession() {
    const value = useContext(AuthContext);
    if (!value) {
        throw new Error('useSession must be wrapped in a <SessionProvider />');
    }
    return value;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<string | null>(null);
    const [user, setUser] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isNewUser, setIsNewUser] = useState(true);

    useEffect(() => {
        async function loadStorageData() {
            try {
                const [token, userData, onboardingStatus] = await Promise.all([
                    AsyncStorage.getItem('user_token'),
                    AsyncStorage.getItem('user_data'),
                    AsyncStorage.getItem('is_new_user'),
                ]);

                if (token) {
                    setSession(token);
                }
                if (userData) {
                    setUser(JSON.parse(userData));
                }

                // If 'is_new_user' is null, they are new. If 'false', they are not.
                if (onboardingStatus === 'false') {
                    setIsNewUser(false);
                }
            } catch (e) {
                console.error('Failed to load storage data', e);
            } finally {
                setIsLoading(false);
            }
        }

        loadStorageData();
    }, []);

    // ── Push Notification Helpers ──────────────────────────────────────────────

    const registerPushToken = async (employeeId: number) => {
        try {
            if (!Device.isDevice) return; // Skip emulator / simulator

            // Resolve EAS projectId — required by getExpoPushTokenAsync.
            // This is set automatically once you run `eas init` and it adds
            // extra.eas.projectId to app.json.
            const projectId =
                Constants.expoConfig?.extra?.eas?.projectId ??
                (Constants as any).easConfig?.projectId;

            if (!projectId) {
                console.log('Push notifications: no EAS projectId in app.json yet — skipping token registration. Run `eas init` to enable.');
                return;
            }

            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') return;

            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            await apiClient.savePushToken(employeeId, tokenData.data);
        } catch (error) {
            // Push registration is non-critical — log but don't block sign-in
            console.warn('Push token registration failed:', error);
        }
    };

    const removePushToken = async (employeeId: number) => {
        try {
            await apiClient.deletePushToken(employeeId);
        } catch (error) {
            console.warn('Push token removal failed:', error);
        }
    };

    // ── Auth Actions ───────────────────────────────────────────────────────────

    const signIn = async (token: string, user: any) => {
        setSession(token);
        setUser(user);
        await AsyncStorage.setItem('user_token', token);
        await AsyncStorage.setItem('user_data', JSON.stringify(user));
        // Register for push notifications after successful login
        if (user?.id) {
            registerPushToken(user.id); // fire-and-forget
        }
    };

    const signOut = async () => {
        // Remove push token before clearing session
        const storedUser = user;
        setSession(null);
        setUser(null);
        await AsyncStorage.removeItem('user_token');
        await AsyncStorage.removeItem('user_data');
        if (storedUser?.id) {
            removePushToken(storedUser.id); // fire-and-forget
        }
    };

    const completeOnboarding = async () => {
        setIsNewUser(false);
        await AsyncStorage.setItem('is_new_user', 'false');
    };

    return (
        <AuthContext.Provider
            value={{
                signIn,
                signOut,
                session,
                user,
                isLoading,
                isNewUser,
                completeOnboarding,
            }}>
            {children}
        </AuthContext.Provider>
    );
}
