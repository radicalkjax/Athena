// This file is a fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { OpaqueColorValue, StyleProp, ViewStyle } from 'react-native';

// Define SymbolWeight type for web compatibility
type SymbolWeight = 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';


// Add your SFSymbol to MaterialIcons mappings here.
const MAPPING: Record<string, string> = {
  // See MaterialIcons here: https://icons.expo.fyi
  // See SF Symbols in the SF Symbols app on Mac.
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'sparkles': 'auto-awesome',
  'person.circle': 'person',
  'magnifyingglass.circle': 'search',
  'desktopcomputer': 'computer',
  'shield.fill': 'shield',
  'network': 'wifi',
  'doc.text': 'description',
  'terminal.fill': 'terminal',
  'exclamationmark.shield': 'security',
  'link': 'link',
  'doc.text.magnifyingglass': 'search',
  'number': 'tag',
  'lock.fill': 'lock',
  'shield.lefthalf.filled': 'security',
  'rectangle.stack': 'layers',
  'eye.slash': 'visibility_off',
  'info.circle': 'info',
  'checkmark.square': 'check_box',
  'square': 'check_box_outline_blank',
  'play.fill': 'play_arrow',
  'trash': 'delete',
  'checkmark': 'check',
  'gear': 'settings',
  'gearshape.fill': 'settings',
  'info.circle.fill': 'info',
  // Additional icons used in the app
  'arrow.up.doc': 'file-upload',
  'exclamationmark.triangle': 'warning',
  'checkmark.circle.fill': 'check_circle',
  'checkmark.shield': 'verified_user',
  'chevron.up': 'keyboard_arrow_up',
  'chevron.down': 'keyboard_arrow_down',
  'doc': 'insert_drive_file'
};

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: any;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name] as any} style={style} />;
}
