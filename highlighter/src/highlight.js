import { styleTags, tags } from "@lezer/highlight";

// This is required by the iecst-parser.js file
export const highlighting = styleTags({
  ControlKeyword: tags.controlKeyword,
  DeclarationKeyword: tags.definitionKeyword,
  ModifierKeyword: tags.modifier,
  TypeKeyword: tags.typeName,
  "TypeName/Identifier": tags.typeName,
  "CallName/Identifier": tags.function(tags.name),

  "MemberExpression/PropertyName/Identifier": tags.propertyName,
  "CallExpression/MemberExpression/Identifier": tags.function(tags.name),
  "CallExpression/Identifier": tags.function(tags.name),
  Identifier: tags.name,

  OperatorKeyword: tags.operatorKeyword,
  Operator: tags.operator,
  CompareOp: tags.operator,
  LogicalOp: tags.operator,

  LineComment: tags.comment,
  MultiLineComment: tags.comment,

  Pragma: tags.annotation,

  StringLiteral: tags.string,
  TypedStringLiteral: tags.string,
  "TypedStringLiteral/TypeKeyword": tags.string,
  NumericLiteral: tags.number,
  TypedNumericLiteral: tags.number,
  "TypedNumericLiteral/TypeKeyword": tags.number,
  DateTimeLiteral: tags.number,
  TypedDateTimeLiteral: tags.number,
  "TypedDateTimeLiteral/TypeKeyword": tags.number,
  BooleanLiteral: tags.bool,
  Punc: tags.punctuation,
});
