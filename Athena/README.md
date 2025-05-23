# Athena - AI-Powered Malware Analysis Assistant

<div align="center">
  <img src="./assets/images/logo.png" alt="Athena Logo" width="200" />
</div>

> **IMPORTANT DISCLAIMER:** The containerization and analysis components described in this documentation are still being designed and developed. Their current implementation and documentation are not reflective of what the final design could be. This documentation represents a conceptual overview and may change significantly as development progresses.

The foundation of Athena's idea and research comes from this research paper by Kali Jackson: [Deep Learning for Malware Analysis](https://radicalkjax.com/2025/04/21/deep-learning-for-malware-analysis.html).

This is the Athena project directory. For comprehensive documentation, please refer to the [main README.md](../README.md) in the root directory.

## 📋 Navigation

<table>
<tr>
<td width="50%" valign="top">

### Quick Links

- [✨ Features](../README.md#-features)
- [🚀 Getting Started](../README.md#-getting-started)
- [📖 User Guide](../README.md#-user-guide)
- [🏗️ Architecture](../README.md#️-architecture)
- [📚 Documentation](../README.md#-documentation)
- [📱 Screenshots](../README.md#-screenshots)
- [💾 Database Setup](./docs/DATABASE_SETUP.md)
- [📊 Container Monitoring](./docs/CONTAINER_MONITORING.md)

</td>
<td width="50%" valign="top">

### 📚 Documentation

- [📘 Getting Started Guide](../docs/GETTING_STARTED.md)
- [📗 User Guide](../docs/USER_GUIDE.md)
- [📐 Architecture Documentation](../docs/ARCHITECTURE.md)
- [🔌 API Integration](../docs/API_INTEGRATION.md)
- [🔒 Container Isolation](../docs/CONTAINER_ISOLATION.md)

**Component Documentation:**
- [AIModelSelector](../docs/components/AI_MODEL_SELECTOR.md)
- [AnalysisOptionsPanel](../docs/components/ANALYSIS_OPTIONS_PANEL.md)
- [AnalysisResults](../docs/components/ANALYSIS_RESULTS.md)
- [ContainerConfigSelector](../docs/components/CONTAINER_CONFIG_SELECTOR.md)
- [FileUploader](../docs/components/FILE_UPLOADER.md)

</td>
</tr>
</table>

## Helper Scripts

Athena comes with several helper scripts to make it easier to set up and run the application. These scripts are located in the `scripts` directory at the root of the repository.

### Setup Script

The setup script helps with the initial setup of Athena:

```bash
# From the root directory
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### API Key Validation Script

The API key validation script checks if your API keys are valid:

```bash
# From the root directory
node scripts/check-api-keys.js
```

### Run Script

The run script helps you run Athena in different modes:

```bash
# From the root directory
chmod +x scripts/run.sh
./scripts/run.sh          # Web mode (default)
./scripts/run.sh ios      # iOS mode
./scripts/run.sh android  # Android mode
./scripts/run.sh expo     # Expo mode
```

## Local Development

For local development, you can use the helper scripts mentioned above, or run the following commands directly from this directory:

```bash
# Install dependencies
npm install

# Start the development server (Note: Currently not working)
npx expo start

# For web development (recommended approach)
npx serve dist
```

> **Note:** The `npx serve dist` command is the recommended way to run the web version of the app. It serves the built app from the dist directory using a static file server.

> **Important:** The Expo launch method is currently not working. Please use the web version with `npx serve dist` instead.

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

- [Home Screen](./screenshots/newHome.png)
- [About Screen](./screenshots/about2.png)
- [Settings Screen](./screenshots/settings2.png)
- [Expanded Container Config View](./screenshots/containerConfig.png)
