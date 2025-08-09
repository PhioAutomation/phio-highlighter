const { registerBlockType } = wp.blocks;
const { PlainText } = wp.blockEditor;

registerBlockType('iecst-highlighter/code-block', {
    title: 'IEC Structured Text Highlighter',
    icon: 'editor-code',
    category: 'formatting',
    attributes: {
        code: { type: 'string', default: '' },
    },
    edit: ({ attributes, setAttributes }) => (
        <PlainText
            value={attributes.code}
            onChange={(value) => setAttributes({ code: value })}
            placeholder="Paste your code here..."
        />
    ),
    save: ({ attributes }) => (
        <pre className="language-phioiecst">
            <code className="language-phioiecst">
                {attributes.code}
            </code>
        </pre>
    )
});