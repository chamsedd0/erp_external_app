import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'setting_theme';

// Shared, subscribable theme preference. Persisted to AsyncStorage and applied
// to React Native's Appearance so `useColorScheme()` reflects it app-wide.
let currentMode: ThemeMode = 'system';
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((l) => l());
}

function isThemeMode(v: unknown): v is ThemeMode {
    return v === 'light' || v === 'dark' || v === 'system';
}

/** Apply a mode to the native Appearance (null = follow the OS). */
function applyToAppearance(mode: ThemeMode) {
    Appearance.setColorScheme(mode === 'system' ? null : mode);
}

export function getThemeMode(): ThemeMode {
    return currentMode;
}

export function subscribeThemeMode(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}

/**
 * Load the persisted theme preference (or fall back to 'system') and apply it.
 * Call once at startup, before the first render.
 */
export async function loadThemePreference(): Promise<ThemeMode> {
    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (isThemeMode(stored)) currentMode = stored;
    } catch {
        // ignore — keep default
    }
    applyToAppearance(currentMode);
    emit();
    return currentMode;
}

/** Persist + apply a new theme preference. */
export async function setThemeMode(mode: ThemeMode): Promise<void> {
    currentMode = mode;
    applyToAppearance(mode);
    emit();
    try {
        await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {
        // best-effort persistence
    }
}
