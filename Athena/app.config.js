import 'dotenv/config';

export default {
  name: 'Athena',
  slug: 'Athena',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'myapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff'
    }
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png'
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff'
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    // Add environment variables here
    openaiApiKey: process.env.OPENAI_API_KEY || null,
    claudeApiKey: process.env.CLAUDE_API_KEY || null,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || null,
    openaiApiBaseUrl: process.env.OPENAI_API_BASE_URL || null,
    claudeApiBaseUrl: process.env.CLAUDE_API_BASE_URL || null,
    deepseekApiBaseUrl: process.env.DEEPSEEK_API_BASE_URL || null,
  }
};
