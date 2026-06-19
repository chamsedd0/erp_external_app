import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * App color scheme.
 *
 * The user's theme preference (light / dark / system) is stored in
 * `lib/theme-preference` and applied via `Appearance.setColorScheme`, so the
 * platform `useColorScheme()` already reflects the chosen mode. We default to
 * 'light' only until the platform reports a value.
 */
export function useColorScheme(): 'light' | 'dark' {
    return useRNColorScheme() ?? 'light';
}
