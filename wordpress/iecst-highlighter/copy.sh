#!/bin/bash

# Copy all the contents to the /wordpress/wp-content/plugins/iecst-highlighter directory
# from both the build output and static files
SRC_BUILD="build"
SRC_CSS="css"
DEST_PLUGIN="../wordpress/wp-content/plugins/iecst-highlighter"

rm -rf "$DEST_PLUGIN"

mkdir -p "$DEST_PLUGIN/build"
mkdir -p "$DEST_PLUGIN/css"

cp -r "$SRC_BUILD"/* "$DEST_PLUGIN/build"
cp -r "$SRC_CSS"/* "$DEST_PLUGIN/css"
cp -r "iecst-highlighter.php" "$DEST_PLUGIN"
cp -r "readme.txt" "$DEST_PLUGIN"

echo "Copy complete!"