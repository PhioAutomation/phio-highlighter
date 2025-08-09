<template>
  <pre class="language-phioiecst">
    <code ref="codeBlock" class="language-phioiecst"><slot /></code>
  </pre>
</template>

<script>
export default {
  name: 'StructuredTextHighlighter',
  mounted() {
    this.highlight();
  },
  updated() {
    this.highlight();
  },
  methods: {
    highlight() {
      if (window.highlightCodeBlocks && this.$refs.codeBlock) {
        window.highlightCodeBlocks(this.$refs.codeBlock);
      }
    }
  }
};
</script>
