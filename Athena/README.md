# Athena - AI-Powered Malware Analysis Assistant

This is the Athena project directory. For comprehensive documentation, please refer to the [main README.md](../README.md) in the root directory.

## Quick Links

- [Features](../README.md#features)
- [Application Screenshots](../README.md#application-screenshots)
- [Getting Started](../README.md#getting-started)
- [Technical Documentation](../README.md#technical-documentation)
- [Key Components](../README.md#key-components)
- [Analysis Process](../README.md#analysis-process)
- [License](../README.md#license)

## Local Development

For local development, you can run the following commands from this directory:

```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# For web development (recommended approach)
npm run start:web
```

> **Note:** The `npm run start:web` command is the recommended way to run the web version of the app. It builds the app with environment variables properly bundled and serves it using a static file server.

## Environment Variables

Athena uses environment variables to securely store API keys for various AI services. This approach is more secure than storing API keys directly in the code or relying solely on local storage.

### Setting Up Environment Variables

1. Create a `.env` file in the root of the Athena directory (this file is already gitignored)
2. Add your API keys to the `.env` file using the following format:

```
# API Keys for AI Models
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Optional: Override API Base URLs if needed
# OPENAI_API_BASE_URL=https://api.openai.com/v1
# CLAUDE_API_BASE_URL=https://api.anthropic.com/v1
# DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1
```

3. You can use the provided `.env.example` file as a template

### How Environment Variables Work

- API keys are first loaded from the `.env` file at build time
- If a key is not found in the environment variables, the app will check AsyncStorage
- Keys entered in the Settings screen are stored in AsyncStorage for persistence
- This approach provides a fallback mechanism while keeping API keys secure

### Security Considerations

- Never commit your `.env` file to version control
- The `.gitignore` file is configured to exclude `.env` files
- API keys stored in AsyncStorage are only accessible to the app itself

## Screenshots

The application screenshots are stored in the `./screenshots` directory:

- [Home Screen](./screenshots/home2.png)
- [About Screen](./screenshots/about2.png)
- [Settings Screen](./screenshots/settings2.png)
