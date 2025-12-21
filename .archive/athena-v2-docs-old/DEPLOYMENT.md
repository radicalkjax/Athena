# Athena v2 Deployment Guide

## Overview

Athena v2 is a Tauri-based malware analysis platform with AI-powered analysis capabilities. This guide covers deployment for macOS, Windows, and Linux.

## Prerequisites

### Development Machine
- Node.js 18+ and npm
- Rust 1.70+ with cargo
- Platform-specific development tools:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio 2022 with C++ workload
  - **Linux**: build-essential, libssl-dev, libgtk-3-dev

### Runtime Requirements
- 4GB RAM minimum (8GB recommended)
- 500MB free disk space
- Internet connection for AI provider APIs

## Configuration

### 1. Environment Setup

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required: AI Provider Keys
VITE_OPENAI_API_KEY=your_key_here
VITE_ANTHROPIC_API_KEY=your_key_here
VITE_DEEPSEEK_API_KEY=your_key_here
VITE_MISTRAL_API_KEY=your_key_here

# Optional: Performance tuning
VITE_MAX_FILE_SIZE_MB=100
VITE_ANALYSIS_TIMEOUT_MS=300000
VITE_MAX_CONCURRENT_ANALYSES=3
```

### 2. Build Configuration

Update `src-tauri/tauri.conf.json` for your deployment:

```json
{
  "productName": "Athena Platform",
  "version": "2.0.0",
  "identifier": "com.yourcompany.athena",
  "bundle": {
    "publisher": "Your Company",
    "copyright": "© 2025 Your Company"
  }
}
```

## Building for Production

### macOS

```bash
# Install dependencies
npm install

# Build WASM modules
cd wasm-modules
./build-all.sh
cd ..

# Copy WASM modules to public directory
cp wasm-modules/*/target/wasm32-unknown-unknown/release/*.wasm public/wasm/

# Build the application
npm run tauri build

# Output: src-tauri/target/release/bundle/dmg/Athena Platform_2.0.0_aarch64.dmg
```

### Windows

```bash
# Install dependencies
npm install

# Build WASM modules
cd wasm-modules
# Run each Cargo build manually on Windows
cargo build --release --target wasm32-unknown-unknown --manifest-path analysis-engine/Cargo.toml
# Repeat for each module...
cd ..

# Copy WASM modules
xcopy wasm-modules\*\target\wasm32-unknown-unknown\release\*.wasm public\wasm\ /Y

# Build the application
npm run tauri build

# Output: src-tauri/target/release/bundle/msi/Athena Platform_2.0.0_x64.msi
```

### Linux

```bash
# Install dependencies
npm install

# Build WASM modules
cd wasm-modules
./build-all.sh
cd ..

# Copy WASM modules
cp wasm-modules/*/target/wasm32-unknown-unknown/release/*.wasm public/wasm/

# Build the application
npm run tauri build

# Output: 
# - AppImage: src-tauri/target/release/bundle/appimage/athena-platform_2.0.0_amd64.AppImage
# - Deb: src-tauri/target/release/bundle/deb/athena-platform_2.0.0_amd64.deb
```

## Deployment Options

### 1. Direct Distribution

Distribute the built artifacts directly:
- **macOS**: `.dmg` file
- **Windows**: `.msi` installer
- **Linux**: `.AppImage` or `.deb` package

### 2. Auto-Update Setup

Configure auto-updates in `tauri.conf.json`:

```json
{
  "updater": {
    "active": true,
    "endpoints": [
      "https://your-server.com/updates/{{target}}/{{arch}}/{{current_version}}"
    ],
    "dialog": true,
    "pubkey": "YOUR_PUBLIC_KEY"
  }
}
```

### 3. Code Signing

#### macOS
```bash
# Sign the app
codesign --sign "Developer ID Application: Your Name" --deep "Athena Platform.app"

# Notarize
xcrun altool --notarize-app --file "Athena Platform.dmg" --type osx --primary-bundle-id com.yourcompany.athena
```

#### Windows
Use signtool with your code signing certificate:
```bash
signtool sign /tr http://timestamp.sectigo.com /td sha256 /fd sha256 /a "Athena Platform.msi"
```

## Server Requirements (Optional)

If deploying with a backend server for centralized analysis:

### Minimum Specifications
- 4 CPU cores
- 8GB RAM
- 100GB SSD storage
- Ubuntu 22.04 LTS or similar

### Setup
```bash
# Install dependencies
sudo apt update
sudo apt install -y nginx postgresql redis

# Configure nginx reverse proxy
sudo nano /etc/nginx/sites-available/athena

# Add configuration
server {
    listen 443 ssl http2;
    server_name athena.yourcompany.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

## Security Considerations

### 1. API Key Management
- Never commit API keys to version control
- Use environment variables or secure key management
- Rotate keys regularly

### 2. File Analysis Limits
- Implement file size limits (default: 100MB)
- Validate file types before analysis
- Use sandboxed WASM execution

### 3. Network Security
- Use HTTPS for all API communications
- Implement rate limiting
- Monitor for suspicious analysis patterns

## Monitoring

### Application Metrics
- Startup time: <2 seconds
- Memory usage: <500MB under normal load
- Analysis completion: <3 seconds with cache

### Logging
Logs are stored in:
- **macOS**: `~/Library/Logs/Athena Platform/`
- **Windows**: `%APPDATA%\Athena Platform\logs\`
- **Linux**: `~/.config/athena-platform/logs/`

### Health Checks
Monitor these endpoints if running with a server:
- `/health` - Application health
- `/metrics` - Prometheus metrics
- `/status` - Detailed status information

## Troubleshooting

### Common Issues

1. **WASM modules not loading**
   - Ensure modules are in `public/wasm/`
   - Check browser console for loading errors
   - Verify WASM MIME type configuration

2. **AI provider errors**
   - Verify API keys are set correctly
   - Check rate limits
   - Ensure network connectivity

3. **High memory usage**
   - Limit concurrent analyses
   - Reduce file size limits
   - Enable virtual scrolling

### Debug Mode
Enable debug logging:
```bash
RUST_LOG=debug ./athena-platform
```

## Support

- Documentation: `/docs` directory
- Issues: GitHub repository
- Security: security@yourcompany.com

## License

See LICENSE file for details.