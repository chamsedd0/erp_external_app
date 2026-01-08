import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    const signIn = async (token: string, user: any) => {
        setSession(token);
        setUser(user);
        await AsyncStorage.setItem('user_token', token);
        await AsyncStorage.setItem('user_data', JSON.stringify(user));
    };

    const signOut = async () => {
        setSession(null);
        setUser(null);
        await AsyncStorage.removeItem('user_token');
        await AsyncStorage.removeItem('user_data');
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
