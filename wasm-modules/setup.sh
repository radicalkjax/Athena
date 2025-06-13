#!/bin/bash

# WASM Development Environment Setup Script
# This script installs all necessary tools for WASM development

set -e

echo "🚀 Setting up WASM development environment for Athena..."

# Install Rust if not already installed
if ! command -v rustc &> /dev/null; then
    echo "📦 Installing Rust toolchain..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "✅ Rust already installed: $(rustc --version)"
fi

# Add wasm32 target
echo "🎯 Adding wasm32-unknown-unknown target..."
rustup target add wasm32-unknown-unknown

# Install wasm-pack
if ! command -v wasm-pack &> /dev/null; then
    echo "📦 Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
else
    echo "✅ wasm-pack already installed: $(wasm-pack --version)"
fi

# Install wasm-bindgen-cli
echo "📦 Installing wasm-bindgen-cli..."
cargo install wasm-bindgen-cli

# Install wasm-opt for optimization
echo "📦 Installing wasm-opt..."
npm install -g wasm-opt

# Create a .cargo/config.toml for the project
mkdir -p /workspaces/Athena/wasm-modules/.cargo
cat > /workspaces/Athena/wasm-modules/.cargo/config.toml << EOF
[build]
target = "wasm32-unknown-unknown"

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = true

[profile.dev]
panic = "abort"
EOF

echo "✅ WASM development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Source the Rust environment: source $HOME/.cargo/env"
echo "2. Navigate to a WASM module directory"
echo "3. Run 'cargo init' to create a new module"
echo "4. Use 'wasm-pack build' to compile to WASM"