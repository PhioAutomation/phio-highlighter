import { __ } from '@wordpress/i18n';
import { useBlockProps } from '@wordpress/block-editor';
import { TextareaControl } from '@wordpress/components';

export default function Edit( { attributes, setAttributes } ) {
	const { content } = attributes;
	const blockProps = useBlockProps();
	return (
		<div { ...blockProps }>
			<TextareaControl
				label="Code Snippet"
				value={ content }
				onChange={ ( value ) => setAttributes( { content: value } ) }
				rows={ 10 }
				placeholder="Enter your code here..."
			/>
		</div>
	);
}
