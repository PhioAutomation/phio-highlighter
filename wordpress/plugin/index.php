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
        add_action('init', array($this, 'registerBlock'));
    }

    function registerBlock() {
        wp_register_script(
            'phio-automation-iecst-highlighter',
            plugin_dir_url(__FILE__) . 'build/index.js',
            array('wp-blocks', 'wp-element', 'wp-i18n', 'wp-block-editor'),
            filemtime(plugin_dir_path(__FILE__) . 'build/index.js')
        );

        register_block_type( __DIR__ . '/build/block.json', array(
            'editor_script' => 'phio-automation-iecst-highlighter',
        ) );
    }
}

$iecstHighlighter = new IecstHighlighter();