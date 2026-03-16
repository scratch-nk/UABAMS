#!/bin/bash
# Increment version number in HTML files

VERSION_FILE=".version"
if [ ! -f "$VERSION_FILE" ]; then
    echo "1" > "$VERSION_FILE"
fi

VERSION=$(cat "$VERSION_FILE")
NEW_VERSION=$((VERSION + 1))
echo $NEW_VERSION > "$VERSION_FILE"

# Update all HTML files with new version
find . -name "*.html" -exec sed -i "s/?v=[0-9]*/?v=$NEW_VERSION/g" {} \;

echo "Updated to version $NEW_VERSION"
