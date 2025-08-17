<?php
/**
 * Plugin Name:       IECST Highlighter
 * Description:       Display beautiful code snippets using the Phio Highlighter for IEC 61131-3 Structured Text
 * Version:           0.1.1
 * Requires at least: 5.5
 * Requires PHP:      7.4
 * Author:            Andrew Parman
 * Author URI:        https://phioautomation.com
 * License:           MIT
 * Text Domain:       iecst-highlighter
 */

if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly.

class IecstHighlighter {
	function __construct() {
		add_action("enqueue_block_editor_assets", array($this, 'adminAssets'));
	}

    function adminAssets() {
        wp_enqueue_script(
            'iecst-highlighter',
            plugin_dir_url( __FILE__ ) . 'build/index.js',
            array( 'wp-blocks', 'wp-element', 'wp-editor' ),
        );
    }
}

$iecstHighlighter = new IecstHighlighter();