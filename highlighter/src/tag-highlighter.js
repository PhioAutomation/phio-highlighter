import { tags, tagHighlighter } from "@lezer/highlight";

// Defines the mapping of tags to CSS classes which need to match the
// Prism class styles
export const highlighter = tagHighlighter([
  { tag: tags.controlKeyword, class: "token keyword control-flow" },
  { tag: tags.operatorKeyword, class: "token keyword" },
  { tag: tags.definitionKeyword, class: "token keyword" },
  { tag: tags.modifier, class: "token keyword" },
  { tag: tags.typeName, class: "token class-name" },

  { tag: tags.number, class: "token number" },
  { tag: tags.bool, class: "token boolean" },
  { tag: tags.string, class: "token string" },

  { tag: tags.annotation, class: "token cdata" },

  { tag: tags.operator, class: "token operator" },
  { tag: tags.punctuation, class: "token punctuation" },
  { tag: tags.separator, class: "token operator" },

  { tag: tags.comment, class: "token comment" },

  { tag: tags.name, class: "token variable" },
  { tag: tags.function(tags.name), class: "token function" },
  { tag: tags.propertyName, class: "token property" },
]);