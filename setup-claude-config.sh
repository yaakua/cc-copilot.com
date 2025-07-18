#!/bin/bash
# Setup script for Claude configuration on macOS/Linux
# This script helps set the CLAUDE_CONFIG_PATH environment variable

echo "Setting up Claude configuration path..."

# Default paths to check
DEFAULT_PATHS=(
    "$HOME/.claude/settings.json"
    "$XDG_CONFIG_HOME/claude/settings.json"
    "$HOME/.config/claude/settings.json"
)

echo "Checking for existing Claude configuration files..."

for path in "${DEFAULT_PATHS[@]}"; do
    if [ -f "$path" ]; then
        echo "Found Claude config at: $path"
        CLAUDE_CONFIG_PATH="$path"
        break
    fi
done

if [ -z "$CLAUDE_CONFIG_PATH" ]; then
    echo "No Claude configuration found in default locations."
    echo "Please specify the path to your Claude settings.json file:"
    read -p "Enter path to Claude settings.json: " CLAUDE_CONFIG_PATH
fi

if [ -f "$CLAUDE_CONFIG_PATH" ]; then
    echo "Setting CLAUDE_CONFIG_PATH environment variable..."
    
    # Add to shell profile
    SHELL_PROFILE=""
    if [ -f "$HOME/.zshrc" ]; then
        SHELL_PROFILE="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        SHELL_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
        SHELL_PROFILE="$HOME/.bash_profile"
    fi
    
    if [ -n "$SHELL_PROFILE" ]; then
        echo "export CLAUDE_CONFIG_PATH=\"$CLAUDE_CONFIG_PATH\"" >> "$SHELL_PROFILE"
        echo "Configuration path added to $SHELL_PROFILE"
        echo "Please restart your terminal or run: source $SHELL_PROFILE"
    else
        echo "Please manually add the following to your shell profile:"
        echo "export CLAUDE_CONFIG_PATH=\"$CLAUDE_CONFIG_PATH\""
    fi
    
    echo "Configuration path set to: $CLAUDE_CONFIG_PATH"
else
    echo "Error: Configuration file not found at $CLAUDE_CONFIG_PATH"
    exit 1
fi