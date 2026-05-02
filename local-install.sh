#!/usr/bin/env bash

set -e

extension_name="jumpy2a-0.0.1.vsix"

if [ -f "$extension_name" ]; then
    echo "Deleting existing $extension_name..."
    rm "$extension_name"
fi

echo "installing packages"
pnpm install --frozen-lockfile

echo "Building extension..."
pnpm run compile

echo "Packaging extension..."
npx @vscode/vsce package --no-dependencies

echo "Installing extension $extension_name..."
code --install-extension "$extension_name"

rm "$extension_name"

echo "Extension installation command issued. Check VS Code."
exit 0
