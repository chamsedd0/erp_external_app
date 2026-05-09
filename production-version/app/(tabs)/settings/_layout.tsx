import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { Platform, useColorScheme } from 'react-native';
import { Text } from '@/components/ui/text';
// expo-glass-effect requires native module not available in Expo Go / Android
const isLiquidGlassAvailable = () => false;

export default function SettingsLayout() {
  const theme = useColorScheme();
  const text = useColor('text');
  const background = useColor('background');

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerTintColor: text,
        headerBlurEffect: isLiquidGlassAvailable()
          ? undefined
          : theme === 'dark'
            ? 'systemMaterialDark'
            : 'systemMaterialLight',
        headerStyle: {
          backgroundColor: isLiquidGlassAvailable()
            ? 'transparent'
            : background,
        },
      }}
    >
      <Stack.Screen
        name='index'
        options={{
          title: 'Settings',
          headerTitle: () =>
            Platform.OS === 'android' ? (
              <Text variant='heading'>Settings</Text>
            ) : undefined,
        }}
      />
    </Stack>
  );
}
