# Linux Tauri Setup Guide

## Fix for "failed to get cargo metadata: No such file or directory"

This error occurs when Rust/Cargo is not installed or not in your PATH.

## Quick Fix Steps:

1. **Install Rust** (if not already installed):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Add Rust to your current shell session**:
   ```bash
   source "$HOME/.cargo/env"
   ```

3. **Verify installation**:
   ```bash
   cargo --version
   ```

4. **Install Linux dependencies**:
   ```bash
   sudo apt-get update
   sudo apt-get install -y \
       libwebkit2gtk-4.1-dev \
       build-essential \
       curl \
       wget \
       file \
       libssl-dev \
       libgtk-3-dev \
       libayatana-appindicator3-dev \
       librsvg2-dev \
       libasound2-dev
   ```

5. **Try running Tauri again**:
   ```bash
   cd athena-v2
   npm run tauri:dev
   ```

## Alternative: If cargo is installed but not found

Add to your `~/.bashrc` or `~/.zshrc`:
```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

Then reload:
```bash
source ~/.bashrc  # or source ~/.zshrc
```