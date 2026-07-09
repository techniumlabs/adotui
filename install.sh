#!/usr/bin/env bash
set -e

# Configuration
REPO="techniumlabs/adotui"
BIN_NAME="adotui"
INSTALL_DIR="/usr/local/bin"

# Detect OS and Architecture
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

if [ "$OS" = "linux" ]; then
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        TARGET="adotui-linux-arm64"
    else
        TARGET="adotui-linux-x64"
    fi
elif [ "$OS" = "darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        TARGET="adotui-macos-arm64"
    else
        TARGET="adotui-macos-x64"
    fi
else
    echo "Unsupported OS: $OS"
    exit 1
fi

echo "Detected platform: $OS ($ARCH)"
echo "Fetching latest release..."

# Get the latest release download URL using GitHub API
LATEST_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep "browser_download_url.*$TARGET" | cut -d '"' -f 4)

if [ -z "$LATEST_URL" ]; then
    echo "Could not find a release for $TARGET."
    exit 1
fi

echo "Downloading $BIN_NAME from $LATEST_URL..."
curl -sL "$LATEST_URL" -o "$BIN_NAME"

echo "Making $BIN_NAME executable..."
chmod +x "$BIN_NAME"

echo "Installing $BIN_NAME to $INSTALL_DIR (might require sudo)..."
sudo mv "$BIN_NAME" "$INSTALL_DIR/$BIN_NAME"

echo "✅ Successfully installed $BIN_NAME to $INSTALL_DIR!"
echo "You can now run '$BIN_NAME' from your terminal."
