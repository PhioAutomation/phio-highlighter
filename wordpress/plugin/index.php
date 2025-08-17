<?php
/**
 * Plugin Name:       IECST Highlighter
 * Description:       Display beautiful code snippets using the Phio Highlighter for IEC 61131-3 Structured Text
 * Version:           0.1.0
 * Author:            Andrew Parman
 * Author URI:        https://phioautomation.com
 * License:           MIT
 * Text Domain:       iecst-highlighter
 */

if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly.

class IecstHighlighter {
    function __construct() {
        add_action( 'enqueue_block_editor_assets', array( $this, 'registerBlock' ) );
    }

    function registerBlock() {
        wp_enqueue_script(
            'iecst-highlighter-block',
            plugin_dir_url(__FILE__) . 'build/index.js',
            array('wp-blocks', 'wp-element', 'wp-editor', 'wp-block-editor'),
            filemtime( plugin_dir_path(__FILE__) . 'build/index.js' )
        );

        wp_enqueue_style(
            'iecst-highlighter-block-editor',
            plugin_dir_url(__FILE__) . 'build/index.css',
            array( 'wp-edit-blocks' ),
            filemtime( plugin_dir_path(__FILE__) . 'build/index.css' )
        );
    }
}

$iecstHighlighter = new IecstHighlighter();