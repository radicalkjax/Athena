# Athena - AI-Powered Malware Analysis Assistant

<div align="center">
  <img src="./assets/images/real-athena-logo.png" alt="Athena Logo" width="200" />
</div>

> **IMPORTANT DISCLAIMER:** The containerization and analysis components described in this documentation are still being designed and developed. Their current implementation and documentation are not reflective of what the final design could be. This documentation represents a conceptual overview and may change significantly as development progresses.

The foundation of Athena's idea and research comes from this research paper by Kali Jackson: [Deep Learning for Malware Analysis](https://radicalkjax.com/2025/04/21/deep-learning-for-malware-analysis.html).

This is the Athena project directory. For comprehensive documentation, please refer to the [main README.md](../README.md) in the root directory.

## 📋 Navigation

<div style="display: flex; justify-content: center; margin: 20px 0;">
  <div style="display: flex; width: 90%; max-width: 1200px; background-color: #f8f9fa; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    
    <!-- Left Column: Quick Links -->
    <div style="flex: 1; padding: 20px; border-right: 1px solid #e1e4e8;">
      <h3 style="margin-top: 0; color: #24292e; font-size: 1.3em; border-bottom: 2px solid #0366d6; padding-bottom: 8px; margin-bottom: 16px;">
        Quick Links
      </h3>
      <ul style="list-style-type: none; padding-left: 0; margin-top: 0;">
        <li style="margin-bottom: 8px;">✨ <a href="../README.md#-features" style="text-decoration: none; color: #0366d6;">Features</a></li>
        <li style="margin-bottom: 8px;">🚀 <a href="../README.md#-getting-started" style="text-decoration: none; color: #0366d6;">Getting Started</a></li>
        <li style="margin-bottom: 8px;">📖 <a href="../README.md#-user-guide" style="text-decoration: none; color: #0366d6;">User Guide</a></li>
        <li style="margin-bottom: 8px;">🏗️ <a href="../README.md#️-architecture" style="text-decoration: none; color: #0366d6;">Architecture</a></li>
        <li style="margin-bottom: 8px;">📚 <a href="../README.md#-documentation" style="text-decoration: none; color: #0366d6;">Documentation</a></li>
        <li style="margin-bottom: 8px;">📱 <a href="../README.md#-screenshots" style="text-decoration: none; color: #0366d6;">Screenshots</a></li>
        <li style="margin-bottom: 8px;">💾 <a href="./docs/DATABASE_SETUP.md" style="text-decoration: none; color: #0366d6;">Database Setup</a></li>
        <li style="margin-bottom: 8px;">📊 <a href="./docs/CONTAINER_MONITORING.md" style="text-decoration: none; color: #0366d6;">Container Monitoring</a></li>
      </ul>
    </div>
    
    <!-- Right Column: Documentation -->
    <div style="flex: 1; padding: 20px;">
      <h3 style="margin-top: 0; color: #24292e; font-size: 1.3em; border-bottom: 2px solid #0366d6; padding-bottom: 8px; margin-bottom: 16px;">
        📚 Documentation
      </h3>
      <ul style="list-style-type: none; padding-left: 0; margin-top: 0;">
        <li style="margin-bottom: 8px;">📘 <a href="../docs/GETTING_STARTED.md" style="text-decoration: none; color: #0366d6;">Getting Started Guide</a></li>
        <li style="margin-bottom: 8px;">📗 <a href="../docs/USER_GUIDE.md" style="text-decoration: none; color: #0366d6;">User Guide</a></li>
        <li style="margin-bottom: 8px;">📐 <a href="../docs/ARCHITECTURE.md" style="text-decoration: none; color: #0366d6;">Architecture Documentation</a></li>
        <li style="margin-bottom: 8px;">🔌 <a href="../docs/API_INTEGRATION.md" style="text-decoration: none; color: #0366d6;">API Integration</a></li>
        <li style="margin-bottom: 8px;">🔒 <a href="../docs/CONTAINER_ISOLATION.md" style="text-decoration: none; color: #0366d6;">Container Isolation</a></li>
        <li style="margin-bottom: 8px; margin-top: 16px;">
          <strong style="display: block; margin-bottom: 8px; color: #24292e;">Component Documentation:</strong>
          <ul style="list-style-type: none; padding-left: 20px;">
            <li style="margin-bottom: 6px;">◦ <a href="../docs/components/AI_MODEL_SELECTOR.md" style="text-decoration: none; color: #0366d6;">AIModelSelector</a></li>
            <li style="margin-bottom: 6px;">◦ <a href="../docs/components/ANALYSIS_OPTIONS_PANEL.md" style="text-decoration: none; color: #0366d6;">AnalysisOptionsPanel</a></li>
            <li style="margin-bottom: 6px;">◦ <a href="../docs/components/ANALYSIS_RESULTS.md" style="text-decoration: none; color: #0366d6;">AnalysisResults</a></li>
            <li style="margin-bottom: 6px;">◦ <a href="../docs/components/CONTAINER_CONFIG_SELECTOR.md" style="text-decoration: none; color: #0366d6;">ContainerConfigSelector</a></li>
            <li style="margin-bottom: 6px;">◦ <a href="../docs/components/FILE_UPLOADER.md" style="text-decoration: none; color: #0366d6;">FileUploader</a></li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</div>

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
