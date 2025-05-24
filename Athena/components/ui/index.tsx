import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps } from 'react';

// Only import expo-symbols on native platforms
let SymbolView: any = null;

// Define SymbolWeight type for web compatibility
type SymbolWeight = 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';

// HapticTab Component
export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}

// TabBarBackground Component
export default function TabBarBackground() {
  return (
    <BlurView
      tint="systemMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

// IconSymbol Component
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code-slash',
  'chevron.right': 'chevron-forward',
  'info.circle': 'information-circle',
  'gear': 'settings',
  // Additional icons used in the app
  'arrow.up.doc': 'cloud-upload',
  'exclamationmark.triangle': 'warning',
  'checkmark.circle.fill': 'checkmark-circle',
  'checkmark.shield': 'shield-checkmark',
  'chevron.up': 'chevron-up',
  'chevron.down': 'chevron-down',
  'doc': 'document',
  'doc.text': 'document-text',
  'doc.text.magnifyingglass': 'search',
  'exclamationmark.shield': 'shield-outline',
  'checkmark.square': 'checkbox',
  'square': 'square-outline',
  'play.fill': 'play',
  'trash': 'trash',
  'checkmark': 'checkmark',
  'sparkles': 'sparkles',
  'person.circle': 'person-circle',
  'magnifyingglass.circle': 'search-circle',
  'desktopcomputer': 'desktop',
  'shield.fill': 'shield',
  'network': 'wifi',
  'terminal.fill': 'terminal',
  'link': 'link',
  'number': 'pricetag',
  'lock.fill': 'lock-closed',
  'shield.lefthalf.filled': 'shield-half',
  'rectangle.stack': 'layers',
  'eye.slash': 'eye-off'
} as Record<string, ComponentProps<typeof Ionicons>['name']>;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SFSymbols on iOS, and Ionicons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols naming conventions and require manual mapping to Ionicons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
  ...rest
}: {
  name: IconSymbolName;
  size?: number;
  color: string;
  style?: any;
  weight?: SymbolWeight;
}) {
  // On web and Android, always use Ionicons
  if (Platform.OS === 'web' || Platform.OS === 'android' || !SymbolView) {
    return (
      <Ionicons
        color={color}
        size={size}
        name={MAPPING[name] ?? 'help-circle'}
        style={style}
      />
    );
  }

  // On iOS, use SymbolView with Ionicons fallback
  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      size={size}
      style={style}
      name={name}
      fallback={
        <Ionicons
          color={color}
          size={size}
          name={MAPPING[name] ?? 'help-circle'}
        />
      }
      {...rest}
    />
  );
}
