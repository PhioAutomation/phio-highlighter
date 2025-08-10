import { __ } from '@wordpress/i18n';
import { useBlockProps } from '@wordpress/block-editor';
import { InspectorControls } from '@wordpress/block-editor';
import { TextareaControl, PanelBody, SelectControl } from '@wordpress/components';

export default function Edit({ attributes, setAttributes }) {
	const { content, cssStyle } = attributes;
	const blockProps = useBlockProps();
	return (
		<>
			<InspectorControls>
				<PanelBody title={ __('IECST Highlighter', 'iecst-highlighter') }>
					<SelectControl
						label={ __('Theme', 'iecst-highlighter') }
						value={ cssStyle }
						options={[
							{ label: 'Default', value: 'default.css' },
							{ label: 'Dark', value: 'dark.css' },
							{ label: 'High Contrast', value: 'contrast.css' }
						]}
						onChange={(newValue) => setAttributes({ cssStyle: newValue })}
					/>
				</PanelBody>
			</InspectorControls>

		<div {...blockProps}>
			<TextareaControl
				label="Code Snippet"
				value={content}
				onChange={(value) => setAttributes({ content: value })}
				rows={10}
				placeholder="Enter your code here..."
			/>
		</div>
		</>
	);
}
