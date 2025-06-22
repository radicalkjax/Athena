# Athena v2 - Tauri Migration

This is the Tauri v2 version of Athena Platform, migrated from React Native for better performance and native integration.

## Prerequisites

1. **System Dependencies** (Linux)
   ```bash
   # For Ubuntu/Debian:
   sudo apt update
   sudo apt install libwebkit2gtk-4.1-dev \
     build-essential \
     curl \
     wget \
     file \
     libssl-dev \
     libgtk-3-dev \
     libayatana-appindicator3-dev \
     librsvg2-dev
   ```

2. **Rust** - Required for Tauri backend
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

3. **Node.js** - Version 16 or higher

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the setup script:
   ```bash
   ./setup.sh
   ```

## Development

Start the development server:
```bash
npm run tauri:dev
```

## Building

Build for production:
```bash
npm run tauri:build
```

## Architecture

- **Frontend**: SolidJS for performance-critical components
- **Backend**: Rust with Tauri v2
- **Styling**: CSS with Barbie aesthetic theme
- **State Management**: SolidJS stores

## Features

- ✅ File upload with SHA-256 hashing
- ✅ AI provider status monitoring
- ✅ Priority-based navigation
- ✅ Responsive design
- 🚧 WASM integration (coming soon)
- 🚧 Full malware analysis pipeline

## Project Structure

```
athena-v2/
├── src-tauri/          # Rust backend
│   ├── src/
│   │   ├── main.rs     # Application entry
│   │   └── commands/   # Tauri commands
│   └── Cargo.toml
├── src/                # Frontend
│   ├── components/     # SolidJS components
│   ├── stores/         # State management
│   └── styles/         # CSS styles
└── package.json
```