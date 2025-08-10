<?php
// This file is generated. Do not modify it manually.
return array(
	'iecst-highlighter' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'create-block/iecst-highlighter',
		'version' => '0.1.0',
		'title' => 'IECST Highlighter',
		'category' => 'widgets',
		'icon' => 'editor-code',
		'description' => 'A syntax highlighter for the IEC 61131-3 structured text language',
		'attributes' => array(
			'content' => array(
				'type' => 'string',
				'source' => 'text',
				'selector' => 'code'
			),
			'cssStyle' => array(
				'type' => 'string',
				'default' => 'default.css'
			)
		),
		'example' => array(
			
		),
		'supports' => array(
			'html' => false
		),
		'textdomain' => 'iecst-highlighter',
		'editorScript' => 'file:./index.js',
		'editorStyle' => 'file:./index.css',
		'viewScript' => 'file:./view.js'
	)
);
