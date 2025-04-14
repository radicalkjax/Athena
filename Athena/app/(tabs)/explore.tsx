import { StyleSheet, Platform, View, Image } from 'react-native';
import { Collapsible } from '@/components/Collapsible';
import { ExternalLink } from '@/components/ExternalLink';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';

export default function ExploreScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#e47a9c', dark: '#d06c86' }}
      headerImage={
        <View style={styles.logoContainer}>
          <Image
            source={require('./../../assets/images/real-athena-logo.png')}
            style={[styles.reactLogo, styles.roundedImage]}
            resizeMode="contain"
          />
        </View>
      }
      title="About Athena">
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={styles.titleText}>About Athena</ThemedText>
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
    backgroundColor: '#d76e8b',
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
  roundedImage: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  titleContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Roboto-Bold',
  },
  description: {
    fontSize: 16,
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
