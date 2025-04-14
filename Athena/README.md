# Athena - AI-Powered Malware Analysis Assistant

Athena is a React Native application designed to help security researchers analyze and deobfuscate malware using various AI models. It provides a secure environment for malware analysis with features like isolated container execution and integration with the Metasploit database.

## Features

- **Multiple AI Models**: Connect to different AI models including OpenAI GPT-4, Claude 3 Opus, DeepSeek Coder, and local models
- **Secure Container Analysis**: Run malware in an isolated container environment for safer analysis
- **Metasploit Integration**: Access the Metasploit database to identify vulnerabilities and related exploits
- **Deobfuscation**: Convert obfuscated malicious code into readable, understandable code
- **Vulnerability Detection**: Identify potential security vulnerabilities in the analyzed code
- **Cross-Platform**: Works on iOS, Android, and web platforms

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the app:
   ```bash
   npx expo start
   ```

3. Open the app in your preferred environment:
   - iOS simulator
   - Android emulator
   - Web browser
   - Expo Go app on a physical device

## Usage

1. **Select an AI Model**: Choose from available AI models for analysis
2. **Upload or Create a File**: Upload a malware file or create a new text file
3. **Configure Analysis Options**: Choose whether to use container isolation
4. **Run Analysis**: Click "Analyze Malware" to start the analysis process
5. **View Results**: Examine the deobfuscated code, analysis report, and detected vulnerabilities

## Security Features

- Secure API key storage using expo-secure-store
- Input sanitization to prevent injection attacks
- Isolated container execution for malware
- Local file storage for sensitive data

## AI Model Configuration

To use the AI models, you need to configure API keys in the app settings:

- **OpenAI**: Requires an OpenAI API key
- **Claude**: Requires an Anthropic API key
- **DeepSeek**: Requires a DeepSeek API key
- **Local Models**: Requires configuration of locally running AI models

## Metasploit Integration

To use the Metasploit integration, you need to configure:

- Metasploit API URL
- Metasploit API key

## Container Configuration

To use the container feature, you need to configure:

- Container API URL
- Container API key

## Development

This project is built with:

- React Native
- Expo
- TypeScript
- Zustand for state management
- Expo Router for navigation

## Project Structure

- `app/`: Main application screens and navigation
- `components/`: Reusable UI components
- `services/`: API services for AI models, container management, etc.
- `store/`: Zustand store for state management
- `types/`: TypeScript type definitions
- `utils/`: Utility functions

## License

This project is intended to serve the infosec community. No more wasted hours ripping apart and reordering code. Let Athena guide your way and unwravel the mysteries of obfuscated code so that you can be the best researcher you can be.
