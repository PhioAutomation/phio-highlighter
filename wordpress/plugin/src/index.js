import { registerBlockType } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import Edit from './edit';
import Save from './save';
import metadata from './block.json';
import './editor.scss';

alert( 'Hello from JS' );

registerBlockType( metadata.name, {
	...metadata,
	edit: Edit,
	save: Save,
} );
