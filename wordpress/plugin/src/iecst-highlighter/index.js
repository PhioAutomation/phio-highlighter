import { registerBlockType } from '@wordpress/blocks';
import './editor.scss';

/**
 * Internal dependencies
 */
import Edit from './edit';
import Save from './save';
import metadata from './block.json';

registerBlockType( metadata, {
	edit: Edit,
	save: Save,
} );
