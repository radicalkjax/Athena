#!/bin/bash

echo "Installing Tauri dependencies for Linux..."

# Update package list
sudo apt-get update

# Install required dependencies for Tauri on Linux
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

echo "Dependencies installed successfully!"
echo ""
echo "If you haven't installed Rust yet, run:"
echo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"