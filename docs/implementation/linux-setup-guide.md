# Linux Setup Guide for Athena v2

**Last Updated**: December 22, 2025
**Supported Distributions**: Ubuntu 20.04+, Debian 11+, Fedora 35+, RHEL 8+

## Prerequisites

### System Requirements

- Linux kernel 5.4+ recommended
- 4GB RAM minimum (8GB recommended for malware analysis)
- 10GB free disk space
- Internet connection for dependency installation

## Complete Setup from Scratch

### 1. Install Rust

```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Select option 1 (default installation)

# Add Rust to current shell session
source "$HOME/.cargo/env"

# Verify installation
rustc --version
cargo --version
```

### 2. Install System Dependencies

#### Ubuntu/Debian 20.04+

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
    libasound2-dev \
    pkg-config
```

#### Fedora 35+

```bash
sudo dnf install -y \
    webkit2gtk4.1-devel \
    openssl-devel \
    gtk3-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel \
    alsa-lib-devel \
    pkg-config \
    gcc \
    gcc-c++
```

#### RHEL 8+ / Rocky Linux

```bash
# Enable EPEL repository
sudo dnf install -y epel-release

# Install dependencies
sudo dnf install -y \
    webkit2gtk4.1-devel \
    openssl-devel \
    gtk3-devel \
    librsvg2-devel \
    alsa-lib-devel \
    pkg-config \
    gcc \
    gcc-c++
```

### 3. Install WASM Toolchain

```bash
# Add wasm32-wasip1 target
rustup target add wasm32-wasip1

# Install cargo-component
cargo install cargo-component --locked

# Verify installation
cargo component --version
```

### 4. Install Node.js 18+

```bash
# Ubuntu/Debian - using NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora/RHEL - using NodeSource
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Verify installation
node --version  # Should be v18.0.0 or higher
npm --version
```

### 5. Clone and Build Athena

```bash
# Clone repository (adjust path as needed)
cd /Users/kali/Athena/Athena/athena-v2

# Install Node.js dependencies
npm install

# Build Rust backend
cd src-tauri
cargo build

# Build WASM modules (optional but recommended)
cd ../wasm-modules/core
for module in */; do
  (cd "$module" && cargo component build --release)
done

# Return to project root
cd /Users/kali/Athena/Athena/athena-v2
```

### 6. Run Athena

```bash
# Development mode
npm run tauri:dev

# Production build
npm run tauri:build
```

## Troubleshooting

### "failed to get cargo metadata: No such file or directory"

This error occurs when Rust/Cargo is not installed or not in your PATH.

**Solution**:
```bash
# Ensure Rust is in PATH
source "$HOME/.cargo/env"

# Add to shell profile for persistence
echo 'source "$HOME/.cargo/env"' >> ~/.bashrc
source ~/.bashrc
```

### "cannot find -lwebkit2gtk-4.1"

Missing WebKitGTK development files.

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel
```

### "pkg-config not found"

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install pkg-config

# Fedora
sudo dnf install pkg-config
```

### Build fails with "linker 'cc' not found"

Missing C compiler.

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# Fedora
sudo dnf groupinstall "Development Tools"
```

### Permission denied for cargo/rustc

**Solution**:
```bash
# Ensure proper ownership of cargo directory
sudo chown -R $USER:$USER ~/.cargo
sudo chown -R $USER:$USER ~/.rustup
```

### Docker not available (for container features)

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install docker.io
sudo systemctl start docker
sudo usermod -aG docker $USER

# Logout and login for group changes to take effect

# Fedora
sudo dnf install docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```

## Post-Installation

### Add to Shell Profile

For permanent PATH configuration, add to `~/.bashrc` or `~/.zshrc`:

```bash
# Rust
export PATH="$HOME/.cargo/bin:$PATH"

# Node.js (if using nvm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

Then reload:
```bash
source ~/.bashrc  # or source ~/.zshrc
```

### Verify Complete Installation

```bash
# Check all tools
rustc --version
cargo --version
cargo component --version
node --version
npm --version
docker --version  # If using containers

# Test Athena build
cd /Users/kali/Athena/Athena/athena-v2
npm run tauri:dev
```

## Distribution-Specific Notes

### Ubuntu 20.04 LTS
- Fully tested and supported
- Use standard APT packages

### Ubuntu 22.04 LTS
- Fully tested and supported
- Recommended distribution

### Debian 11 (Bullseye)
- Fully supported
- May need to enable backports for newer packages

### Fedora 38+
- Fully supported
- Use DNF package manager

### Arch Linux
```bash
# Install dependencies
sudo pacman -S webkit2gtk base-devel openssl gtk3 libappindicator-gtk3 librsvg

# Follow standard Rust/Node.js installation steps above
```

## Resources

- [Rust Installation Guide](https://www.rust-lang.org/tools/install)
- [Node.js Downloads](https://nodejs.org/)
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Athena Documentation](/Users/kali/Athena/Athena/docs/)