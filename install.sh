#!/usr/bin/env bash
set -e

# Configuration
REPO="techniumlabs/adotui"
BIN_NAME="adotui"
INSTALL_DIR="/usr/local/bin"

# Detect OS and Architecture
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

if [[ "$OS" == *mingw* ]] || [[ "$OS" == *msys* ]] || [[ "$OS" == *cygwin* ]]; then
    OS="windows"
fi

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
elif [ "$OS" = "windows" ]; then
    BIN_NAME="adotui.exe"
    INSTALL_DIR="/usr/bin"
    if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
        TARGET="adotui-windows-arm64.exe"
    else
        TARGET="adotui-windows-x64.exe"
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

echo "Installing $BIN_NAME to $INSTALL_DIR..."
if command -v sudo >/dev/null 2>&1; then
    sudo mv "$BIN_NAME" "$INSTALL_DIR/$BIN_NAME"
else
    mv "$BIN_NAME" "$INSTALL_DIR/$BIN_NAME"
fi

echo "✅ Successfully installed $BIN_NAME to $INSTALL_DIR!"
echo "You can now run '$BIN_NAME' from your terminal."
