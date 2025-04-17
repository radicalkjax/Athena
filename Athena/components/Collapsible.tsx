import { PropsWithChildren, useState } from 'react';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useColorScheme() ?? 'light';

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity
        style={styles.heading}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}>
        <ThemedView style={styles.emojiContainer}>
          <Text style={{ fontSize: 18 }}>✨</Text>
        </ThemedView>

        <ThemedText type="defaultSemiBold" style={{ color: '#000' , fontWeight: 'bold', fontSize: 25}}>{title}</ThemedText>
      </TouchableOpacity>
      {isOpen && (
        <ThemedView style={styles.contentWrapper}>
          <ThemedView style={styles.content}>{children}</ThemedView>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
    borderRadius: 12,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  contentWrapper: {
    backgroundColor: '#ffd1dd',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  content: {
    marginLeft: 10,
    borderRadius: 12,
    padding: 10,
  },
  emojiContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#d76e8b',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
});
