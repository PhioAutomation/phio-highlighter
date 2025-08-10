<?php
/**
 * Plugin Name:       Iecst Highlighter
 * Description:       Example block scaffolded with Create Block tool.
 * Version:           0.1.0
 * Requires at least: 6.7
 * Requires PHP:      7.4
 * Author:            The WordPress Contributors
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       iecst-highlighter
 *
 * @package CreateBlock
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}
/**
 * Registers the block using a `blocks-manifest.php` file, which improves the performance of block type registration.
 * Behind the scenes, it also registers all assets so they can be enqueued
 * through the block editor in the corresponding context.
 *
 * @see https://make.wordpress.org/core/2025/03/13/more-efficient-block-type-registration-in-6-8/
 * @see https://make.wordpress.org/core/2024/10/17/new-block-type-registration-apis-to-improve-performance-in-wordpress-6-7/
 */

function create_block_iecst_highlighter_block_init() {
	/**
	 * Registers the block(s) metadata from the `blocks-manifest.php` and registers the block type(s)
	 * based on the registered block metadata.
	 * Added in WordPress 6.8 to simplify the block metadata registration process added in WordPress 6.7.
	 *
	 * @see https://make.wordpress.org/core/2025/03/13/more-efficient-block-type-registration-in-6-8/
	 */
	if ( function_exists( 'wp_register_block_types_from_metadata_collection' ) ) {
		wp_register_block_types_from_metadata_collection( __DIR__ . '/build', __DIR__ . '/build/blocks-manifest.php' );
		return;
	}

	/**
	 * Registers the block(s) metadata from the `blocks-manifest.php` file.
	 * Added to WordPress 6.7 to improve the performance of block type registration.
	 *
	 * @see https://make.wordpress.org/core/2024/10/17/new-block-type-registration-apis-to-improve-performance-in-wordpress-6-7/
	 */
	if ( function_exists( 'wp_register_block_metadata_collection' ) ) {
		wp_register_block_metadata_collection( __DIR__ . '/build', __DIR__ . '/build/blocks-manifest.php' );
	}
	/**
	 * Registers the block type(s) in the `blocks-manifest.php` file.
	 *
	 * @see https://developer.wordpress.org/reference/functions/register_block_type/
	 */
	$manifest_data = require __DIR__ . '/build/blocks-manifest.php';
	foreach ( array_keys( $manifest_data ) as $block_type ) {
		register_block_type( __DIR__ . "/build/{$block_type}" );
	}
}
add_action( 'init', 'create_block_iecst_highlighter_block_init' );

// Register a setting for the global CSS selection
function iecst_highlighter_register_settings() {
	register_setting(
		'general', // Settings group
		'iecst_highlighter_css', // Option name
		[
			'type' => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default' => 'phio-dark.css',
		]
	);
	add_settings_field(
		'iecst_highlighter_css',
		'IECST Highlighter CSS Theme',
		'iecst_highlighter_css_field_html',
		'general',
		'default',
		[ 'label_for' => 'iecst_highlighter_css' ]
	);
}
add_action( 'admin_init', 'iecst_highlighter_register_settings' );

// Render the dropdown for the available CSS files
function iecst_highlighter_css_field_html() {
	$css_dir = plugin_dir_path( __FILE__ ) . 'css/';
	$css_url = plugins_url( 'css/', __FILE__ );
	$files = array_filter( scandir( $css_dir ), function( $file ) {
		return preg_match( '/\.css$/', $file );
	});
	$current = get_option( 'iecst_highlighter_css', 'phio-dark.css' );
	echo '<select id="iecst_highlighter_css" name="iecst_highlighter_css">';
	foreach ( $files as $file ) {
		$selected = $file === $current ? 'selected' : '';
		echo "<option value='$file' $selected>$file</option>";
	}
	echo '</select>';
}

// Enqueue the selected CSS file globally
function iecst_highlighter_enqueue_global_css() {
	$selected = get_option( 'iecst_highlighter_css', 'phio-dark.css' );
	$css_url = plugins_url( 'css/' . $selected, __FILE__ );
	wp_enqueue_style(
		'iecst-highlighter-global-style',
		$css_url,
		array(),
		filemtime( plugin_dir_path( __FILE__ ) . 'css/' . $selected )
	);
}
add_action( 'enqueue_block_assets', 'iecst_highlighter_enqueue_global_css' );
