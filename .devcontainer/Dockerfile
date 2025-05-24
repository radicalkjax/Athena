# Base DevContainer Image
FROM ghcr.io/containercraft/devcontainer:extra

# List additional apt dependencies
ARG DEBIAN_FRONTEND=noninteractive
ARG APT_PKGS="\
    git \
    lz4 \
    screenfetch"

# Install dependencies
RUN sudo apt-get update && \
    sudo apt-get install -y $APT_PKGS && \
    sudo apt-get clean && \
    sudo rm -rf /var/lib/apt/lists/* && \
    sudo rm -rf /tmp/* && \
    sudo rm -rf /var/tmp/*
