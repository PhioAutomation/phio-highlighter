#!/bin/bash

set -e

# Copy the latest highlighter build

# Run the linters and formatters
npm run format
npm run lint:css

# Build the project
npm run build

# Add in the static assets

# Copy all the contents to the /wordpress/wp-content/plugins/iecst-highlighter directory
# from both the build output and static files
SRC_BUILD="build"
SRC_ASSETS="assets"
DEST_PLUGIN="../wordpress/wp-content/plugins/iecst-highlighter"

rm -rf "$DEST_PLUGIN"

mkdir -p "$DEST_PLUGIN/build"
mkdir -p "$DEST_PLUGIN/assets"

cp -r "$SRC_BUILD"/* "$DEST_PLUGIN/build"
cp -r "$SRC_ASSETS"/* "$DEST_PLUGIN/assets"
cp -r "index.php" "$DEST_PLUGIN"
cp -r "readme.txt" "$DEST_PLUGIN"

echo "Build complete!"