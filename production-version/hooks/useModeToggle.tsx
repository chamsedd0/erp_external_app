import { useColorScheme } from '@/hooks/useColorScheme';
import { useSyncExternalStore } from 'react';
import { ColorSchemeName } from 'react-native';
import {
  getThemeMode,
  setThemeMode,
  subscribeThemeMode,
  type ThemeMode,
} from '@/lib/theme-preference';

type Mode = ThemeMode;

interface UseModeToggleReturn {
  isDark: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
  currentMode: ColorSchemeName;
  toggleMode: () => void;
}

/**
 * Theme toggle backed by the persisted preference in `lib/theme-preference`.
 * `mode` is the user's choice (light/dark/system); `isDark` resolves 'system'
 * against the live OS scheme.
 */
export function useModeToggle(): UseModeToggleReturn {
  const mode = useSyncExternalStore(subscribeThemeMode, getThemeMode, getThemeMode);
  const colorScheme = useColorScheme();

  const isDark = mode === 'system' ? colorScheme === 'dark' : mode === 'dark';

  const setMode = (newMode: Mode) => {
    void setThemeMode(newMode);
  };

  // Cycle light → dark → system → light.
  const toggleMode = () => {
    setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light');
  };

  return {
    isDark,
    mode,
    setMode,
    currentMode: mode === 'system' ? colorScheme : mode,
    toggleMode,
  };
}
