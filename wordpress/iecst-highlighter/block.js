const { registerBlockType } = wp.blocks;
const { PlainText } = wp.blockEditor;

registerBlockType('iecst-highlighter/code-block', {
    title: 'IEC Structured Text Highlighter',
    icon: 'editor-code',
    category: 'formatting',
    attributes: {
        code: { type: 'string', default: '' },
    },
    edit: function({ attributes, setAttributes }) {
        return wp.element.createElement(PlainText, {
            value: attributes.code,
            onChange: function(value) { setAttributes({ code: value }); },
            placeholder: '// Your code here!'
        });
    },
    save: function({ attributes }) {
        return wp.element.createElement(
            'pre', { className: 'language-phioiecst' },
            wp.element.createElement('code', { className: 'language-phioiecst' }, attributes.code)
        );
    }
});