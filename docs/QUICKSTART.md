# 🚀 Athena Quick Start Guide

Get Athena running in under 2 minutes!

## Prerequisites

- **Node.js v16+** - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/downloads)

## One-Command Setup & Launch

```bash
# Clone the repository
git clone https://github.com/yourusername/athena.git
cd athena

# Run Athena (auto-setup + launch)
./scripts/run.sh
```

**That's it!** 🎉

The script will automatically:
- ✅ Check your system requirements
- ✅ Install all dependencies
- ✅ Configure web polyfills for browser compatibility
- ✅ Set up environment files
- ✅ Build the application
- ✅ Launch the web server at http://localhost:3000

## What happens on first run?

When you run `./scripts/run.sh` for the first time, you'll see:

```
🔧 First time setup detected, running setup process...

✓ Node.js is installed (v18.17.0)
✓ npm is installed (9.6.7)
✓ Git is installed (git version 2.39.2)
✓ Root dependencies installed successfully
✓ Athena dependencies installed successfully
✓ Web polyfills installed successfully
✓ Serve installed globally
✓ Created .env file from template
✓ Webpack configuration found
✓ Metro configuration found
✓ Package.json found
✓ Web polyfills are configured

✓ Setup complete!

🚀 Setup complete! Now starting the application...

✓ Build completed successfully
Starting web server...
```

## Next Steps

1. **Add API Keys** (optional):
   - Edit `Athena/.env` to add your AI model API keys
   - Get keys from: [OpenAI](https://platform.openai.com/account/api-keys), [Claude](https://console.anthropic.com/account/keys), [DeepSeek](https://platform.deepseek.com/)

2. **Start Analyzing**:
   - Upload malware files
   - Select AI models
   - Configure analysis options
   - View results

## Advanced Usage

```bash
# Force setup only (without running)
./scripts/run.sh setup

# Run different platforms
./scripts/run.sh web      # Web version (default)
./scripts/run.sh ios      # iOS (requires macOS + Xcode)
./scripts/run.sh android  # Android (requires Android SDK)

# Get help
./scripts/run.sh help
```

## Troubleshooting

If you encounter issues:

1. **Check Node.js version**: `node -v` (should be v16+)
2. **Force clean setup**: 
   ```bash
   rm -rf node_modules Athena/node_modules
   ./scripts/run.sh setup
   ```
3. **Check the logs** - the script provides detailed error messages

## Need Help?

- 📖 [Full Documentation](./README.md)
- 📘 [Getting Started Guide](./docs/GETTING_STARTED.md)
- 📗 [User Guide](./docs/USER_GUIDE.md)

---

**Happy analyzing!** 🛡️🔍
