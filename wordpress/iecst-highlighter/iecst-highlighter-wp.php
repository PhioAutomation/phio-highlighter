<?php
/**
 * Plugin Name: IEC Structured Text Syntax Highlighter
 * Description: Adds syntax highlighting to code blocks using the Phio Automation Highlighter.
 * Version: 1.0.0
 * Author: Andrew Parman
 */

if ( ! defined( 'ABSPATH' ) ) exit; // No direct access

// Register scripts/styles once
function iecst_register_assets() {
    wp_register_style(
        'iecst-theme',
        plugins_url('highlighter/themes/default.css', __FILE__)
    );

    wp_register_script(
        'iecst-js',
        plugins_url('highlighter/iecst.js', __FILE__),
        array(),
        '1.0.0',
        true
    );
}
add_action('init', 'iecst_register_assets');

// Enqueue for front-end
add_action('wp_enqueue_scripts', function() {
    wp_enqueue_style('iecst-theme');
    wp_enqueue_script('iecst-js');
});

// Enqueue for block editor
add_action('enqueue_block_editor_assets', function() {
    wp_enqueue_style('iecst-theme');
    wp_enqueue_script('iecst-js');
});

// Register Gutenberg Block
function iecst_highlighter_register_block() {
    wp_register_script(
        'iecst-highlighter-block',
        plugins_url('block.js', __FILE__),
        array('wp-blocks', 'wp-element', 'wp-editor'),
        '1.0.0',
        true
    );

    register_block_type('iecst-highlighter/code-block', array(
        'editor_script' => 'iecst-highlighter-block',
    ));
}
add_action('init', 'iecst_highlighter_register_block');