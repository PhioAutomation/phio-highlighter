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
        add_action( 'admin_init', array( $this, 'adminInit' ) );
        add_action( 'enqueue_block_editor_assets', array( $this, 'registerBlock' ) );
        add_action( 'enqueue_block_assets', array( $this, 'enqueueBlockAssets' ) );
    }

    function adminInit() {
        register_setting(
            'general', // Settings group
            'iecst_highlighter_css', // Option name
            [
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default' => 'phio-light.css',
            ]
        );
        add_settings_field(
            'iecst_highlighter_css',
            'IECST Highlighter CSS Theme',
            array( $this, 'themeFieldHtml' ),
            'general',
            'default',
            [ 'label_for' => 'iecst_highlighter_css' ]
        );
    }

    // Render the dropdown for the available CSS files
    function themeFieldHtml() {
        $css_dir = plugin_dir_path( __FILE__ ) . 'assets/css/';
        $css_url = plugins_url( 'assets/css/', __FILE__ );
        $files = array_filter( scandir( $css_dir ), function( $file ) {
            return preg_match( '/\\.css$/', $file );
        });
        $current = get_option( 'iecst_highlighter_css', 'phio-light.css' );
        echo '<select id="iecst_highlighter_css" name="iecst_highlighter_css">';
        foreach ( $files as $file ) {
            $selected = $file === $current ? 'selected' : '';
            echo "<option value='" . esc_attr($file) . "' " . esc_attr($selected) . ">" . esc_html($file) . "</option>";
        }
        echo '</select>';
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

    function enqueueBlockAssets() {
        // Add the front-end script
        wp_enqueue_script(
            'iecst-highlighter-view',
            plugin_dir_url( __FILE__ ) . 'build/iecst.js',
            array(),
            filemtime( plugin_dir_path( __FILE__ ) . 'build/iecst.js' ),
            true // Load in footer
        );

        // Enqueue the selected CSS file
        $selected = get_option( 'iecst_highlighter_css', 'phio-light.css' );
        $css_url = plugins_url( 'assets/css/' . $selected, __FILE__ );
        wp_enqueue_style(
            'iecst-highlighter-global-style',
            $css_url,
            array(),
            filemtime( plugin_dir_path( __FILE__ ) . 'assets/css/' . $selected )
        );
    }
}

$iecstHighlighter = new IecstHighlighter();