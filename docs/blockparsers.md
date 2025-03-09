# Block Level Markdown Elements

According to [Gruber](https://daringfireball.net/projects/markdown/),

> The overriding design goal for Markdown’s formatting syntax is
> to make it as readable as possible. The idea is that a Markdown-formatted
> document should be publishable as-is, as plain text, without looking like
> it’s been marked up with tags or formatting instructions.

This version of markdown supports that ideal by being a little more strict
than many Markdown dialects, including original Markdown. In particular,
Markdown often allows the writer to be a bit lazy with indentation. For
example, in the blockquote syntax,

> Markdown allows you to be lazy and only put the > before the first line
> of a hard-wrapped paragraph

So this is valid Markdown, but it's not 100% clear what the author means:

```
> This is a blockquote.
Blockquotes are for quoting things.
```

Is the second sentence supposed to be part of the blockquote, as Markdown assumes?
Or is it after the blockquote as the layout suggests? This version of markdown expects layout
to **explicitly** convey meaning to create readable documents which are "publishable as-is".

In addition, a simple set of layout rules makes the resultant HTML more predictable for
the author.



## Parsing

Blocks are parsed line-by-line using block-level parsers. A block level parser is an
object with the following properties

### `name`
A string. The name of the parser, and often the name of the node it creates.

### `startsWith`
A string. This declares that if a line does **not** start with any character in `startsWith`,
then the parser will fail on that line. It's used to make the block level parsing a bit
faster - the parser only needs to be invoked if the first character of the line being
looked at is in startsWith.

### `parse`
A function which takes an array of lines and an object containing the parse_blocks and
parse_inline functions. It should parse the lines (starting at line[0]) for the block.

* If the parse function succeeds, it modifies the lines array (removeing those that match the block)
and returns the node created. A node is an object `{name, children}` where `name` is
the name of the node (usually its HTML tag) and `children` is an array of nodes.
* If parse function fails, the lines array should be left unchanged.

### `init` (optional)
Called before parsing to do setup as needed. Most parsers don't have this.

### `postprocess` (optional)
Called after parsing to perform any followup actions. This function takes the
parsed syntax tree (array of nodes, as it happens) and returns a (possibly altered)
syntax tree.




### Headers

A header starts with 1 to 6 '#' followed by a space, then the header text. If it goes over
more than one line, use a line continuation. The header text is passed to the `inline_parse`
function.

Only atx-style headers are supported, because Setext headers look ugly.

#### Examples
```
# This is a level 1 header.
## This is level 2.
###This isn't a header because there is no space between the # and the text.
####### This isn't a header because it has 7 # marks
\# This isn't a header because the # has been escaped.
```

These atx headers shouldn't be closed with # at the end of the line. No-one does that anyhow.


### Block Quote

A block quote is a set of lines starting with '>' and (optionally) one space.

Example
```
> This is a block quote
> You can put other block level elements inside it like
>* lists
>* tables
>* other block quotes
This line isn't part of the quote, which is more restrictive than original Markdown.
```

The lines following the '>' and with up to one space removed, is parsed again.


### Indented Codeblock

A series of lines starting with *at least* four spaces is
considered a code block. The right indentation can be a bit hit-or-miss
in lists.

This is ugly and unpredictable, but very standard, No more to be said about it.


### Fenced Codeblock

any set of lines between a line starting with \`\`\` and a subsequent line starting with \`\`\`
is considered a code block.

The first \`\`\` may be followed by a type (e.g. the programming language). 

The type provides a simple extension mechanism. If there is a fence handler defined
for that type, the code block is passed to it. Otherwise, the code block
is turned  into text lines. One predefined type
is `verbatim` which simply passes the code block contents through to the final document without alteration. The process of turning a fenced block into html may depend on the 
printer function.

The code block has a type property which is the type of block created.


### Unordered List

An unordered list consists of a series of list items. Each item
has one line starting with list marker, * or + or -, followed by any number of
indented lines or blanks.

The list idem is dedented by up to 2 spaces before recursion.

This is more strict than standard markdown.



### Ordered List

An unordered list consists of a series of list items. Each item
has one line starting with a list marker, followed by any number of
indented lines or blanks.

A list marker is a number or a lower case letter or a roman numeral followed by
) or .

The list idem is dedented by up to 2 spaces before recursion.

This is more strict than standard markdown.



### Horizontal Rule

Any line starting with ---, ***, or ___ causes a horizontal rule.
Currently, any text following the line marking is ignored.

Add after unordered list


### footnote definition

A footnote definition is a line beginning [^number]: followed by
any number of indented or blank lines.


### href definition

A href definition is a line beginning [number]: It is one line only


### SCRIPT, HEAD, and HTML comments

These tags are passed through verbatim. This allows you to
put markdown inside an html doc & process the markdown in the body.



### Other HTML tags

These tags are passed through verbatim. They must be alone on the line
block level so other block elements can be put in them.


### Tables

A table is a series of rows. A row is chunks of text separated by |
If the second row of the table is |:-- etc, then a header row is created.

The start and end | must be included too. any text after the last | is ignored.

