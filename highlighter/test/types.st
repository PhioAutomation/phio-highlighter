# Types

VAR
  a : BOOL;
  b : BYTE;
  c : SINT;
  d : USINT;
  e : WORD;
  f : INT;
  g : UINT;
  h : DWORD;
  i : DINT;
  j : UDINT;
  k : LWORD;
  l : LINT;
  m : ULINT;
  n : REAL;
  o : LREAL;
  p : CHAR;
  q : WCHAR;
  r : STRING;
  s : WSTRING;
  t : TIME;
  u : LTIME;
  v : DATE_AND_TIME;
  w : LDATE_AND_TIME;
  x : DATE;
  y : LDATE;
  z : TIME_OF_DAY;
  aa : LTIME_OF_DAY;
  ab : BIT;
  ac : ANY;
  ad : ANY_DATE;
  ae : ANY_BIT;
  af : ANY_NUM;
  ag : ANY_REAL;
  ah : ANY_INT;
  ai : ANY_STRING;
  aj : UCHAR;
  ak : USTRING;
END_VAR

==>

Program(
  Declaration(
    VarDeclaration(
      DeclarationKeyword,

      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),

      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),

      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      VariableDeclarationStatement(Identifier, Punc, TypeKeyword, Punc),
      DeclarationKeyword
    )
  )
)