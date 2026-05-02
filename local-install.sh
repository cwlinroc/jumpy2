#!/usr/bin/env bash

set -e

extension_name="jumpy2a-0.0.1.vsix"

if [ -f "$extension_name" ]; then
    echo "Deleting existing $extension_name..."
    rm "$extension_name"
fi

echo "installing packages"
pnpm install --frozen-lockfile

echo "Packaging extension..."
npx @vscode/vsce package --no-dependencies
if [ $? -ne 0 ]; then
    echo "ERROR: vsce package command failed!"
    exit 1
fi

echo "Installing extension $extension_name..."
code --install-extension "$extension_name"
if [ $? -ne 0 ]; then
    echo "ERROR: code --install-extension command failed!"
    exit 1
fi

rm "$extension_name"

echo "Extension installation command issued. Check VS Code."
exit 0
