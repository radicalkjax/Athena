import React from 'react';
import { Text, TextStyle } from 'react-native';

interface EmojiProps {
  emoji: string;
  size?: number;
  style?: TextStyle;
}

// Map of common emoji names to Unicode characters
const emojiMap: { [key: string]: string } = {
  sparkles: '✨',
  star: '⭐',
  fire: '🔥',
  rocket: '🚀',
  check: '✅',
  cross: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  lock: '🔒',
  unlock: '🔓',
  key: '🔑',
  shield: '🛡️',
  bug: '🐛',
  gear: '⚙️',
  magnifier: '🔍',
  computer: '💻',
  folder: '📁',
  file: '📄',
  chart: '📊',
  bulb: '💡',
};

export default function Emoji({ emoji, size = 20, style }: EmojiProps) {
  const emojiChar = emojiMap[emoji] || emoji;
  
  return (
    <Text style={[{ fontSize: size }, style]}>
      {emojiChar}
    </Text>
  );
}