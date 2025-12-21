#!/bin/bash

echo "Fixing Tauri 2 Linux setup..."
echo "=============================="

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "Rust is not installed. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    source "$HOME/.cargo/env"
    echo "Rust installed successfully!"
else
    echo "Rust is already installed: $(rustc --version)"
fi

# Install Linux-specific dependencies
echo ""
echo "Installing Tauri Linux dependencies..."
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

echo ""
echo "Setup complete! Now you can run:"
echo "cd athena-v2 && npm run tauri:dev"