import { StyleSheet, Platform, View, Image } from 'react-native';
import { Collapsible } from '@/components/Collapsible';
import { ExternalLink } from '@/components/ExternalLink';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import Emoji from 'react-emojis';

export default function AboutScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#e47a9c', dark: '#d06c86' }}
      headerImage={
        <View style={styles.logoContainer}>
          <Image
            source={require('./../../assets/images/logo.png')}
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
        <ThemedText style={styles.featureDescription}>
          Athena supports multiple AI models for malware analysis:
        </ThemedText>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>
            <ThemedText style={styles.featureDescription}>OpenAI GPT-4</ThemedText> - Advanced code analysis and deobfuscation
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>
            <ThemedText style={styles.featureDescription}>Claude 3 Opus</ThemedText> - Detailed malware analysis
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>
            <ThemedText style={styles.featureDescription}>DeepSeek Coder</ThemedText> - Specialized code model for deobfuscation
          </ThemedText>
        </ThemedView>
      </Collapsible>
      
      <Collapsible title="Secure Container Analysis">
        <ThemedText style={styles.featureDescription}>
          Athena can run malware in an isolated container environment for safer analysis. This helps prevent any potential harm to your system while analyzing malicious code.
        </ThemedText>
        <ThemedText style={styles.featureDescription}>
          The container provides:
        </ThemedText>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>Isolated execution environment</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>Network activity monitoring</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>File system activity tracking</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>Execution logs and behavior analysis</ThemedText>
        </ThemedView>
      </Collapsible>
      
      <Collapsible title="Metasploit Integration">
        <ThemedText style={styles.featureDescription}>
          Athena integrates with the Metasploit database to provide information about vulnerabilities detected in the analyzed code.
        </ThemedText>
        <ThemedText style={styles.featureDescription}>
          This integration helps you:
        </ThemedText>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>Identify known vulnerabilities</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>Find related Metasploit modules</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>Get detailed vulnerability information</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>Reference CVE IDs when available</ThemedText>
        </ThemedView>
      </Collapsible>
      
      <Collapsible title="Security Features">
        <ThemedText style={styles.featureDescription}>
          Athena is designed with security in mind:
        </ThemedText>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>Secure API key storage using expo-secure-store</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>Input sanitization to prevent injection attacks</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
          <ThemedText style={styles.listItemText}>Isolated container execution for malware</ThemedText>
        </ThemedView>
        <ThemedView style={styles.listItem}>
          <View style={styles.emojiContainer}>
            <Emoji emoji="sparkles" size={16} />
          </View>
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
    backgroundColor: 'transparent',
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
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 5,
    color: '#000',
  },
  emojiContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#d76e8b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemText: {
    color: '#000',
    marginLeft: 10,
    flex: 1,
    fontSize: 17,
  },
  featureDescription: {
    marginTop: 5,
    marginBottom: 20,
    fontWeight: 'bold',
    color: '#000',
    fontSize: 18,
    alignItems: 'center',
  },
  footer: {
    marginTop: 30,
    marginBottom: 20,
    alignItems: 'center',
    borderRadius: 12,
  },
  footerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  footerVersion: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 5,
    color: '#000',
  },
});
