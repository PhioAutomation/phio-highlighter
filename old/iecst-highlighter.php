<?php

// if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly.

// class IecstHighlighter {
// 	function __construct() {
// 		add_action("enqueue_block_editor_assets")
// 	}


// }

// $iecstHighlighter = new IecstHighlighter();



// function create_block_iecst_highlighter_block_init() {
// 	register_block_type( __DIR__ . '/build/iecst-highlighter' );
// }
// add_action( 'init', 'create_block_iecst_highlighter_block_init' );

// // Register a setting for the global CSS selection
// function iecst_highlighter_register_settings() {
// 	register_setting(
// 		'general', // Settings group
// 		'iecst_highlighter_css', // Option name
// 		[
// 			'type' => 'string',
// 			'sanitize_callback' => 'sanitize_text_field',
// 			'default' => 'phio-light.css',
// 		]
// 	);
// 	add_settings_field(
// 		'iecst_highlighter_css',
// 		'IECST Highlighter CSS Theme',
// 		'iecst_highlighter_css_field_html',
// 		'general',
// 		'default',
// 		[ 'label_for' => 'iecst_highlighter_css' ]
// 	);
// }
// add_action( 'admin_init', 'iecst_highlighter_register_settings' );

// // Render the dropdown for the available CSS files
// function iecst_highlighter_css_field_html() {
// 	$css_dir = plugin_dir_path( __FILE__ ) . 'assets/css/';
// 	$css_url = plugins_url( 'assets/css/', __FILE__ );
// 	$files = array_filter( scandir( $css_dir ), function( $file ) {
// 		return preg_match( '/\\.css$/', $file );
// 	});
// 	$current = get_option( 'iecst_highlighter_css', 'phio-light.css' );
// 	echo '<select id="iecst_highlighter_css" name="iecst_highlighter_css">';
// 	foreach ( $files as $file ) {
// 		$selected = $file === $current ? 'selected' : '';
// 		echo "<option value='$file' $selected>$file</option>";
// 	}
// 	echo '</select>';
// }

// // Enqueue the selected CSS file globally
// function iecst_highlighter_enqueue_global_css() {
// 	$selected = get_option( 'iecst_highlighter_css', 'phio-light.css' );
// 	$css_url = plugins_url( 'assets/css/' . $selected, __FILE__ );
// 	wp_enqueue_style(
// 		'iecst-highlighter-global-style',
// 		$css_url,
// 		array(),
// 		filemtime( plugin_dir_path( __FILE__ ) . 'assets/css/' . $selected )
// 	);
// }
// add_action( 'enqueue_block_assets', 'iecst_highlighter_enqueue_global_css' );
