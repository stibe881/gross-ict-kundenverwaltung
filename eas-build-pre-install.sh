#!/bin/bash
# Fix EACCES permission error for .expo/web directory during EAS prebuild
# The @expo/image-utils package needs this directory for icon caching

echo "[eas-build-pre-install] Fixing .expo directory permissions..."

# Create .expo/web with proper permissions
mkdir -p .expo/web
chmod -R 777 .expo

echo "[eas-build-pre-install] Done."
