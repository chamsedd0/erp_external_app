import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient, setUnauthorizedHandler } from '../api/client';

interface AuthContextType {
    signIn: (token: string, user: any) => Promise<void>;
    signOut: () => Promise<void>;
    session: string | null;
    user: any | null;
    isLoading: boolean;
    isNewUser: boolean;
    completeOnboarding: () => Promise<void>;
    tenantSlug: string | null;
    tenantName: string | null;
    hrEmail: string | null;
    setTenant: (slug: string, name: string, hrEmail: string) => Promise<void>;
    clearTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    signIn: async () => { },
    signOut: async () => { },
    session: null,
    user: null,
    isLoading: true,
    isNewUser: false,
    completeOnboarding: async () => { },
    tenantSlug: null,
    tenantName: null,
    hrEmail: null,
    setTenant: async () => { },
    clearTenant: async () => { },
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
    const [tenantSlug, setTenantSlug] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState<string | null>(null);
    const [hrEmail, setHrEmail] = useState<string | null>(null);

    useEffect(() => {
        async function loadStorageData() {
            try {
                const [token, userData, onboardingStatus, slug, name, email] = await Promise.all([
                    AsyncStorage.getItem('user_token'),
                    AsyncStorage.getItem('user_data'),
                    AsyncStorage.getItem('is_new_user'),
                    AsyncStorage.getItem('tenant_slug'),
                    AsyncStorage.getItem('tenant_name'),
                    AsyncStorage.getItem('tenant_hr_email'),
                ]);

                if (token) setSession(token);
                if (userData) setUser(JSON.parse(userData));
                if (onboardingStatus === 'false') setIsNewUser(false);
                if (slug) setTenantSlug(slug);
                if (name) setTenantName(name);
                if (email) setHrEmail(email);
            } catch (e) {
                console.error('Failed to load storage data', e);
            } finally {
                setIsLoading(false);
            }
        }

        loadStorageData();
    }, []);

    // ── Tenant Actions ─────────────────────────────────────────────────────────

    const setTenant = async (slug: string, name: string, email: string) => {
        setTenantSlug(slug);
        setTenantName(name);
        setHrEmail(email);
        await AsyncStorage.multiSet([
            ['tenant_slug', slug],
            ['tenant_name', name],
            ['tenant_hr_email', email],
        ]);
    };

    const clearTenant = async () => {
        setTenantSlug(null);
        setTenantName(null);
        setHrEmail(null);
        await AsyncStorage.multiRemove(['tenant_slug', 'tenant_name', 'tenant_hr_email']);
    };

    // ── Push Notification Helpers ──────────────────────────────────────────────

    const registerPushToken = async (employeeId: number, slug: string) => {
        try {
            if (!Device.isDevice) return; // Skip emulator / simulator

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
            await apiClient.savePushToken(employeeId, tokenData.data, slug);
        } catch (error) {
            console.warn('Push token registration failed:', error);
        }
    };

    const removePushToken = async (employeeId: number, slug: string) => {
        try {
            await apiClient.deletePushToken(employeeId, slug);
        } catch (error) {
            console.warn('Push token removal failed:', error);
        }
    };

    // ── Auth Actions ───────────────────────────────────────────────────────────

    const signIn = async (token: string, userData: any) => {
        setSession(token);
        setUser(userData);
        await AsyncStorage.setItem('user_token', token);
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));
        if (userData?.id && tenantSlug) {
            registerPushToken(userData.id, tenantSlug); // fire-and-forget
        }
    };

    const signOut = async () => {
        const storedUser = user;
        const storedSlug = tenantSlug; // capture before state clears
        setSession(null);
        setUser(null);
        await AsyncStorage.removeItem('user_token');
        await AsyncStorage.removeItem('user_data');
        // NOTE: tenant is NOT cleared on sign out — user stays on same company for next login
        if (storedUser?.id && storedSlug) {
            removePushToken(storedUser.id, storedSlug); // fire-and-forget
        }
    };

    const completeOnboarding = async () => {
        setIsNewUser(false);
        await AsyncStorage.setItem('is_new_user', 'false');
    };

    // ── Unauthorized handler ──────────────────────────────────────────────────
    const signOutRef = useRef(signOut);
    signOutRef.current = signOut;

    useEffect(() => {
        setUnauthorizedHandler(() => {
            signOutRef.current();
        });
    }, []);

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
                tenantSlug,
                tenantName,
                hrEmail,
                setTenant,
                clearTenant,
            }}>
            {children}
        </AuthContext.Provider>
    );
}
