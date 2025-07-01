# Athena v2 Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### 1. Prerequisites
- Node.js 18+ and Rust installed
- macOS, Windows, or Linux

### 2. Clone and Setup
```bash
git clone https://github.com/yourcompany/athena-v2
cd athena-v2
npm install
```

### 3. Configure API Keys
```bash
cp .env.example .env
# Edit .env and add your AI provider API keys
```

### 4. Build WASM Modules
```bash
cd wasm-modules
./build-all.sh  # or build.bat on Windows
cd ..
cp wasm-modules/*/target/wasm32-unknown-unknown/release/*.wasm public/wasm/
```

### 5. Run Development Mode
```bash
npm run tauri dev
```

The app will open automatically!

## 🎯 First Analysis

1. **Upload a File**: Drag and drop or click to upload
2. **Select Analysis Type**: 
   - Static Analysis (Alt+1)
   - Dynamic Analysis (Alt+2)
   - Memory Analysis (Alt+3)
   - Network Analysis (Alt+4)
3. **Run AI Analysis**: Choose providers (OpenAI, Anthropic, etc.)
4. **Export Results**: JSON, CSV, PDF, Excel, or Encrypted

## ⚡ Keyboard Shortcuts

- `Ctrl+O`: Open file
- `Ctrl+S`: Save report
- `Ctrl+E`: Export
- `Alt+1-4`: Quick analysis modes
- `Ctrl+Shift+D`: Toggle debug

## 🏗️ Build for Production

```bash
npm run tauri build
```

Find your installer in:
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/appimage/`

## 📦 What's Included

- **7 WASM Security Modules**: PE parser, string extractor, entropy analyzer, etc.
- **4 AI Providers**: OpenAI, Anthropic, DeepSeek, Mistral
- **5 Export Formats**: JSON, CSV, PDF, Excel, Encrypted
- **Real-time Monitoring**: CPU, Memory, Network, Processes
- **Barbie UI Theme**: Pink aesthetic with smooth animations

## 🔧 Troubleshooting

### App won't start?
```bash
RUST_LOG=debug npm run tauri dev
```

### WASM modules missing?
```bash
ls public/wasm/  # Should show 7 .wasm files
```

### AI analysis failing?
Check your `.env` file has valid API keys

## 📚 Next Steps

- Read the full [Deployment Guide](./DEPLOYMENT.md)
- Check [Performance Report](./performance-report.md)
- Review [Architecture Docs](./docs/)

## 🎉 Ready to Analyze!

You're all set! Start analyzing files and exploring Athena's powerful features.