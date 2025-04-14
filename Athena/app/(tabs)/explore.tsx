import { StyleSheet, Platform, View, Image } from 'react-native';
import { Collapsible } from '@/components/Collapsible';
import { ExternalLink } from '@/components/ExternalLink';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function ExploreScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#e47a9c', dark: '#d06c86' }}
      headerImage={
        <View style={styles.logoContainer}>
          <Image
            source={require('./../../assets/images/real-athena-logo.png')}
            style={styles.reactLogo}
            resizeMode="contain"
          />
        </View>
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">About Athena</ThemedText>
      </ThemedView>
      
      <ThemedText style={styles.description}>
        Athena is your AI-powered assistant for malware analysis and deobfuscation. It helps security researchers understand obfuscated code and identify potential vulnerabilities.
      </ThemedText>
      
      <Collapsible title="AI Models">
        <ThemedText>
          Athena supports multiple AI models for malware analysis:
        </ThemedText>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="sparkles" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>
            <ThemedText type="defaultSemiBold">OpenAI GPT-4</ThemedText> - Advanced code analysis and deobfuscation
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="person.circle" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>
            <ThemedText type="defaultSemiBold">Claude 3 Opus</ThemedText> - Detailed malware analysis
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="magnifyingglass.circle" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>
            <ThemedText type="defaultSemiBold">DeepSeek Coder</ThemedText> - Specialized code model for deobfuscation
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="desktopcomputer" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>
            <ThemedText type="defaultSemiBold">Local Models</ThemedText> - Support for locally running AI models
          </ThemedText>
        </ThemedView>
      </Collapsible>
      
      <Collapsible title="Secure Container Analysis">
        <ThemedText>
          Athena can run malware in an isolated container environment for safer analysis. This helps prevent any potential harm to your system while analyzing malicious code.
        </ThemedText>
        <ThemedText style={styles.featureDescription}>
          The container provides:
        </ThemedText>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="shield.fill" size={16} color="#e47a9c" />
          <ThemedText style={styles.listItemText}>Isolated execution environment</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="network" size={16} color="#e47a9c" />
          <ThemedText style={styles.listItemText}>Network activity monitoring</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="doc.text" size={16} color="#e47a9c" />
          <ThemedText style={styles.listItemText}>File system activity tracking</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="terminal.fill" size={16} color="#e47a9c" />
          <ThemedText style={styles.listItemText}>Execution logs and behavior analysis</ThemedText>
        </ThemedView>
      </Collapsible>
      
      <Collapsible title="Metasploit Integration">
        <ThemedText>
          Athena integrates with the Metasploit database to provide information about vulnerabilities detected in the analyzed code.
        </ThemedText>
        <ThemedText style={styles.featureDescription}>
          This integration helps you:
        </ThemedText>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="exclamationmark.shield" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>Identify known vulnerabilities</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="link" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>Find related Metasploit modules</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="doc.text.magnifyingglass" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>Get detailed vulnerability information</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="number" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>Reference CVE IDs when available</ThemedText>
        </ThemedView>
      </Collapsible>
      
      <Collapsible title="Security Features">
        <ThemedText>
          Athena is designed with security in mind:
        </ThemedText>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="lock.fill" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>Secure API key storage using expo-secure-store</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="shield.lefthalf.filled" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>Input sanitization to prevent injection attacks</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="rectangle.stack" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>Isolated container execution for malware</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <IconSymbol name="eye.slash" size={16} color="#d06c86" />
          <ThemedText style={styles.listItemText}>Local file storage for sensitive data</ThemedText>
        </ThemedView>
      </Collapsible>
      
      <ThemedView style={styles.footer}>
        <ThemedText style={styles.footerText}>
          Athena - Malware Analysis Assistant
        </ThemedText>
        <ThemedText style={styles.footerVersion}>
          Version 1.0.0
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    backgroundColor: '#e47a9c',
    justifyContent: 'center',
    alignItems: 'center',
    height: 250,
    width: '100%',
  },
  reactLogo: {
    height: 200,
    width: 300,
    alignSelf: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  listItemText: {
    marginLeft: 10,
    flex: 1,
  },
  featureDescription: {
    marginTop: 10,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 30,
    marginBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerVersion: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 5,
  },
});
import { StyleSheet, Image, Platform } from 'react-native';

import { Collapsible } from '@/components/Collapsible';
import { ExternalLink } from '@/components/ExternalLink';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function TabTwoScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Explore</ThemedText>
      </ThemedView>
      <ThemedText>This app includes example code to help you get started.</ThemedText>
      <Collapsible title="File-based routing">
        <ThemedText>
          This app has two screens:{' '}
          <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> and{' '}
          <ThemedText type="defaultSemiBold">app/(tabs)/explore.tsx</ThemedText>
        </ThemedText>
        <ThemedText>
          The layout file in <ThemedText type="defaultSemiBold">app/(tabs)/_layout.tsx</ThemedText>{' '}
          sets up the tab navigator.
        </ThemedText>
        <ExternalLink href="https://docs.expo.dev/router/introduction">
          <ThemedText type="link">Learn more</ThemedText>
        </ExternalLink>
      </Collapsible>
      <Collapsible title="Android, iOS, and web support">
        <ThemedText>
          You can open this project on Android, iOS, and the web. To open the web version, press{' '}
          <ThemedText type="defaultSemiBold">w</ThemedText> in the terminal running this project.
        </ThemedText>
      </Collapsible>
      <Collapsible title="Images">
        <ThemedText>
          For static images, you can use the <ThemedText type="defaultSemiBold">@2x</ThemedText> and{' '}
          <ThemedText type="defaultSemiBold">@3x</ThemedText> suffixes to provide files for
          different screen densities
        </ThemedText>
        <Image source={require('@/assets/images/real-athena-logo.jpg')} style={{ alignSelf: 'center' }} />
        <ExternalLink href="https://reactnative.dev/docs/images">
          <ThemedText type="link">Learn more</ThemedText>
        </ExternalLink>
      </Collapsible>
      <Collapsible title="Custom fonts">
        <ThemedText>
          Open <ThemedText type="defaultSemiBold">app/_layout.tsx</ThemedText> to see how to load{' '}
          <ThemedText style={{ fontFamily: 'SpaceMono' }}>
            custom fonts such as this one.
          </ThemedText>
        </ThemedText>
        <ExternalLink href="https://docs.expo.dev/versions/latest/sdk/font">
          <ThemedText type="link">Learn more</ThemedText>
        </ExternalLink>
      </Collapsible>
      <Collapsible title="Light and dark mode components">
        <ThemedText>
          This template has light and dark mode support. The{' '}
          <ThemedText type="defaultSemiBold">useColorScheme()</ThemedText> hook lets you inspect
          what the user's current color scheme is, and so you can adjust UI colors accordingly.
        </ThemedText>
        <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
          <ThemedText type="link">Learn more</ThemedText>
        </ExternalLink>
      </Collapsible>
      <Collapsible title="Animations">
        <ThemedText>
          This template includes an example of an animated component. The{' '}
          <ThemedText type="defaultSemiBold">components/HelloWave.tsx</ThemedText> component uses
          the powerful <ThemedText type="defaultSemiBold">react-native-reanimated</ThemedText>{' '}
          library to create a waving hand animation.
        </ThemedText>
        {Platform.select({
          ios: (
            <ThemedText>
              The <ThemedText type="defaultSemiBold">components/ParallaxScrollView.tsx</ThemedText>{' '}
              component provides a parallax effect for the header image.
            </ThemedText>
          ),
        })}
      </Collapsible>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});
