import { useBlockProps } from '@wordpress/block-editor';

export default function save({ attributes }) {
	const { content, cssStyle } = attributes;
    const blockProps = useBlockProps.save();
	return (
        <div {...blockProps}>
            <pre className="language-phioiecst">
                <code className="language-phioiecst">{content}</code>
            </pre>
        </div>
    );
}
