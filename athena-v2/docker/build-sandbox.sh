#!/bin/bash
# Athena Sandbox Container Build Script
# Builds Docker images for malware analysis sandboxing

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  Athena Sandbox Container Builder"
echo "========================================"
echo ""

# Check Docker is available
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed or not in PATH"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "ERROR: Docker daemon is not running"
    echo "Please start Docker and try again"
    exit 1
fi

echo "[1/2] Building Linux sandbox image..."
echo "      This may take several minutes on first build..."
echo ""

docker build \
    -f Dockerfile.sandbox-linux \
    -t athena-sandbox:latest \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    . 2>&1 | while read line; do echo "      $line"; done

if [ $? -eq 0 ]; then
    echo ""
    echo "      Linux sandbox built successfully: athena-sandbox:latest"
else
    echo ""
    echo "ERROR: Failed to build Linux sandbox image"
    exit 1
fi

# Windows sandbox (optional - requires Windows Docker host)
if [[ "$1" == "--with-windows" ]]; then
    echo ""
    echo "[2/2] Building Windows sandbox image..."
    echo "      NOTE: Requires Windows Docker host with Windows containers enabled"
    echo ""

    docker build \
        -f Dockerfile.sandbox-windows \
        -t athena-sandbox-windows:latest \
        . 2>&1 | while read line; do echo "      $line"; done

    if [ $? -eq 0 ]; then
        echo ""
        echo "      Windows sandbox built successfully: athena-sandbox-windows:latest"
    else
        echo ""
        echo "WARNING: Failed to build Windows sandbox (requires Windows Docker host)"
    fi
else
    echo ""
    echo "[2/2] Skipping Windows sandbox (use --with-windows to build)"
fi

echo ""
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Available images:"
docker images | grep athena-sandbox || echo "  (none found - build may have failed)"
echo ""
echo "To test the sandbox:"
echo "  docker run --rm athena-sandbox:latest echo 'Sandbox working!'"
echo ""
echo "The Athena application will automatically use these images"
echo "for dynamic malware analysis."
echo ""
