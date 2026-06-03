import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '../locales/en.json';
import ar from '../locales/ar.json';

export const SUPPORTED_LANGS = ['en', 'ar'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export const STORAGE_KEY = 'setting_language';

export const i18n = new I18n({ en, ar });
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

function isSupported(code: string | null | undefined): code is Lang {
    return !!code && (SUPPORTED_LANGS as readonly string[]).includes(code);
}

/** Best-effort device language, constrained to supported langs. */
export function deviceLang(): Lang {
    const code = getLocales?.()?.[0]?.languageCode ?? 'en';
    return isSupported(code) ? code : 'en';
}

/** Translate a key. Thin wrapper so screens import a single `t`. */
export function t(key: string, options?: Record<string, any>): string {
    return i18n.t(key, options);
}

/**
 * Load the persisted language (or device default) and apply it.
 * Called once at startup, before the first render.
 */
export async function loadStoredLang(): Promise<Lang> {
    let lang: Lang = 'en';
    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        lang = isSupported(stored) ? stored : deviceLang();
    } catch {
        lang = deviceLang();
    }
    i18n.locale = lang;
    // Keep the native RTL flag aligned on cold start (no reload needed here —
    // the app is booting, so layout picks up the correct direction).
    const targetRTL = lang === 'ar';
    if (I18nManager.isRTL !== targetRTL) {
        I18nManager.allowRTL(targetRTL);
        I18nManager.forceRTL(targetRTL);
    }
    return lang;
}

/**
 * Persist + apply a new language. Returns whether a layout-direction flip is
 * pending — the caller should prompt the user to restart the app when true,
 * since React Native only re-lays-out RTL on reload.
 */
export async function setLocale(lang: Lang): Promise<{ needsReload: boolean }> {
    await AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
    const targetRTL = lang === 'ar';
    const needsReload = I18nManager.isRTL !== targetRTL;
    i18n.locale = lang;
    if (needsReload) {
        I18nManager.allowRTL(targetRTL);
        I18nManager.forceRTL(targetRTL);
    }
    return { needsReload };
}
