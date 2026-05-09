import { Stack } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';
// expo-glass-effect requires native module not available in Expo Go / Android
const isLiquidGlassAvailable = () => false;
import { useColor } from '@/hooks/useColor';
import { Text } from '@/components/ui/text';

export default function HomeLayout() {
  const theme = useColorScheme();
  const text = useColor('text');
  const background = useColor('background');

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerTransparent: true,
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
          title: 'Home',
          headerTitle: () =>
            Platform.OS === 'android' ? (
              <Text variant='heading'>Home</Text>
            ) : undefined,
        }}
      />
    </Stack>
  );
}
