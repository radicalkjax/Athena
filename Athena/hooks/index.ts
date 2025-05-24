import { useColorScheme as useNativeColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

/**
 * The useColorScheme value is always either light or dark, but the built-in
 * type suggests that it can be null. This will not happen in practice, so this
 * makes it a bit easier to work with.
 */
export function useColorScheme() {
  return useNativeColorScheme() ?? 'light';
}

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
