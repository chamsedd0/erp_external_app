import { Platform } from 'react-native';

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

const zinc = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
};

const semantic = {
  success: '#10b981', // Emerald 500
  warning: '#f59e0b', // Amber 500
  error: '#ef4444',   // Red 500
  info: '#3b82f6',    // Blue 500
};

export const lightColors = {
  background: '#F6F8FB',
  foreground: '#111827',

  card: '#ffffff',
  cardForeground: '#111827',

  popover: '#ffffff',
  popoverForeground: '#111827',

  primary: '#2563EB',
  primaryForeground: '#ffffff',

  secondary: '#EEF2F7',
  secondaryForeground: '#1F2937',

  muted: '#EEF2F7',
  mutedForeground: '#64748B',

  accent: '#E0F2FE',
  accentForeground: '#075985',

  destructive: '#ef4444',
  destructiveForeground: '#ffffff',

  border: '#D7DEE8',
  input: '#D7DEE8',
  ring: '#93C5FD',

  text: '#111827',
  textMuted: '#64748B',

  tint: '#2563EB',
  icon: '#64748B',
  tabIconDefault: '#94A3B8',
  tabIconSelected: '#2563EB',

  // Semantic mappings
  semanticSuccess: semantic.success,
  semanticWarning: semantic.warning,
  semanticError: semantic.error,
  semanticInfo: semantic.info,

  // Direct color aliases used by primitive components
  red: semantic.error,
  green: semantic.success,
};

export const darkColors = {
  background: zinc[950],
  foreground: '#ffffff',

  card: zinc[900],
  cardForeground: '#ffffff',

  popover: zinc[900],
  popoverForeground: '#ffffff',

  primary: '#ffffff',
  primaryForeground: zinc[900],

  secondary: zinc[800],
  secondaryForeground: '#ffffff',

  muted: zinc[800],
  mutedForeground: zinc[400],

  accent: zinc[800],
  accentForeground: '#ffffff',

  destructive: '#7f1d1d',
  destructiveForeground: '#ffffff',

  border: zinc[800],
  input: zinc[800],
  ring: zinc[600],

  text: '#ffffff',
  textMuted: zinc[400],

  tint: '#ffffff',
  icon: zinc[400],
  tabIconDefault: zinc[600],
  tabIconSelected: '#ffffff',

  // Semantic mappings
  semanticSuccess: semantic.success,
  semanticWarning: semantic.warning,
  semanticError: semantic.error,
  semanticInfo: semantic.info,

  // Direct color aliases used by primitive components
  red: semantic.error,
  green: semantic.success,
};

export const Colors = {
  light: lightColors,
  dark: darkColors,
};
