#!/bin/bash

echo "Setting up Athena v2 development environment..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "Rust is not installed. Please install Rust first:"
    echo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "Then run: source $HOME/.cargo/env"
    exit 1
fi

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Optional: Install Tauri CLI globally
echo "Installing Tauri CLI globally (optional)..."
npm install -g @tauri-apps/cli

echo "Setup complete! You can now run:"
echo "  npm run tauri:dev    # For development"
echo "  npm run tauri:build  # For production build"