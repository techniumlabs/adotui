#!/usr/bin/env bash
set -e

BIN_NAME="adotui"
INSTALL_DIR="/usr/local/bin"

# Detect OS
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
if [[ "$OS" == *mingw* ]] || [[ "$OS" == *msys* ]] || [[ "$OS" == *cygwin* ]]; then
    OS="windows"
fi

if [ "$OS" = "windows" ]; then
    BIN_NAME="adotui.exe"
    INSTALL_DIR="/usr/bin"
fi

TARGET_PATH="$INSTALL_DIR/$BIN_NAME"

if [ -f "$TARGET_PATH" ]; then
    echo "Removing $TARGET_PATH..."
    if command -v sudo >/dev/null 2>&1; then
        sudo rm "$TARGET_PATH"
    else
        rm "$TARGET_PATH"
    fi
    echo "✅ Successfully uninstalled $BIN_NAME!"
else
    echo "Could not find $BIN_NAME at $TARGET_PATH."
fi
