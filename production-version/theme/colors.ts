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

const pastels = {
  purple: '#E9E4F5',
  blue: '#CBF0F9',
  pink: '#FADCE0',
  green: '#D3F3DA',
  offWhite: '#FDFBF9',
  black: '#0E0E10',
};

export const lightColors = {
  background: pastels.offWhite,
  foreground: pastels.black,

  card: '#ffffff',
  cardForeground: pastels.black,

  popover: '#ffffff',
  popoverForeground: pastels.black,

  primary: pastels.black,
  primaryForeground: '#ffffff',

  secondary: zinc[100],
  secondaryForeground: pastels.black,

  muted: zinc[100],
  mutedForeground: zinc[500],

  accent: zinc[100],
  accentForeground: pastels.black,

  destructive: '#ef4444',
  destructiveForeground: '#ffffff',

  border: zinc[200],
  input: zinc[200],
  ring: zinc[400],

  text: pastels.black,
  textMuted: zinc[500],

  tint: pastels.black,
  icon: zinc[500],
  tabIconDefault: zinc[400],
  tabIconSelected: pastels.black,

  // Semantic mappings for the new design
  pastelPurple: pastels.purple,
  pastelBlue: pastels.blue,
  pastelPink: pastels.pink,
  pastelGreen: pastels.green,

  blue: '#007AFF',
  green: '#34C759',
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  pink: '#FF2D92',
  purple: '#AF52DE',
  teal: '#5AC8FA',
  indigo: '#5856D6',
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

  // Semantic mappings (Dark mode versions of pastels - muted)
  pastelPurple: '#2D2B35',
  pastelBlue: '#1E2F36',
  pastelPink: '#362225',
  pastelGreen: '#1E3324',

  blue: '#0A84FF',
  green: '#30D158',
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  pink: '#FF375F',
  purple: '#BF5AF2',
  teal: '#64D2FF',
  indigo: '#5E5CE6',
};

export const Colors = {
  light: lightColors,
  dark: darkColors,
};
