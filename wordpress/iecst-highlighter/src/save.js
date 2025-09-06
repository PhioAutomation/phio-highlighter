import { useBlockProps } from '@wordpress/block-editor';

export default function Save( { attributes } ) {
	const { content } = attributes;
	return (
		<div { ...useBlockProps.save() }>
			<pre className="language-phioiecst">
				<code className="language-phioiecst">{ content }</code>
			</pre>
		</div>
	);
}
