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

# Get the latest release metadata using GitHub API
RELEASE_HEADERS="$(mktemp)"
RELEASE_BODY="$(mktemp)"

if [ -n "${GITHUB_TOKEN:-}" ]; then
    RELEASE_STATUS=$(curl -sS -L \
        -D "$RELEASE_HEADERS" \
        -o "$RELEASE_BODY" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO/releases/latest" \
        -w "%{http_code}" || true)
else
    RELEASE_STATUS=$(curl -sS -L \
        -D "$RELEASE_HEADERS" \
        -o "$RELEASE_BODY" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "https://api.github.com/repos/$REPO/releases/latest" \
        -w "%{http_code}" || true)
fi

if [ "$RELEASE_STATUS" != "200" ]; then
    RELEASE_REMAINING=$(awk -F': ' 'tolower($1)=="x-ratelimit-remaining" {gsub("\r", "", $2); print $2}' "$RELEASE_HEADERS" | tail -n 1)
    RELEASE_RESET=$(awk -F': ' 'tolower($1)=="x-ratelimit-reset" {gsub("\r", "", $2); print $2}' "$RELEASE_HEADERS" | tail -n 1)
    RELEASE_RETRY_AFTER=$(awk -F': ' 'tolower($1)=="retry-after" {gsub("\r", "", $2); print $2}' "$RELEASE_HEADERS" | tail -n 1)

    if { [ "$RELEASE_STATUS" = "403" ] && [ "${RELEASE_REMAINING:-}" = "0" ]; } || [ "$RELEASE_STATUS" = "429" ]; then
        echo "GitHub API rate limit hit (HTTP $RELEASE_STATUS)."
        if [ -n "${RELEASE_RETRY_AFTER:-}" ]; then
            echo "Retry after: ${RELEASE_RETRY_AFTER}s"
        fi
        if [ -n "${RELEASE_RESET:-}" ]; then
            echo "Rate limit resets at unix time: $RELEASE_RESET"
        fi
        echo "Set GITHUB_TOKEN to increase your GitHub API rate limit and run the installer again."
    else
        echo "Failed to fetch latest release metadata from GitHub (HTTP $RELEASE_STATUS)."
    fi

    cat "$RELEASE_BODY" >&2
    rm -f "$RELEASE_HEADERS" "$RELEASE_BODY"
    exit 1
fi

LATEST_URL=$(grep "browser_download_url.*$TARGET" "$RELEASE_BODY" | cut -d '"' -f 4)
rm -f "$RELEASE_HEADERS" "$RELEASE_BODY"

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
