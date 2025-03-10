# scratchmark.js

An implementation of John Gruber's markdown. Scratchmark doesn't try for full compatibility. 
According to [Gruber](https://daringfireball.net/projects/markdown/),

> The overriding design goal for Markdown’s formatting syntax is
> to make it as readable as possible. The idea is that a Markdown-formatted
> document should be publishable as-is, as plain text, without looking like
> it’s been marked up with tags or formatting instructions.

But Markdown allows writers to be quite lazy with indentation, even
though that might affect readability negatively. This version of markdown supports
readability by being a little more strict about indentation than many Markdown dialects, including original Markdown. The increased strictness also makes the link between Markdown and the subsequent HTML a bit easier to follow if it does not produce what you're expecting.

## Standard Markdown Elements

### Paragraphs.
Paragraphs are one or more lines of text (that aren't any of the below block elements) that **end with** a blank line. If they don't have a blank line at the end, they are just text. 

Text is automatically escaped, so that <, >, and & are changed into their HTML entities.

### Headings.

A heading is a single line starting with one to six `#` characters, then a space, and then the
heading text. The number of `#` characters gives the heading level. For example:

```
# Heading level 1
## Heading level 2
### Heading level 3

###Not a heading because there is no space between the # and the text.
```

Headings may end in `#` characters as well. Headings do not extend over more than one line. If
you want to write a long heading, use the line-continuation character `\` at the end of the line.

The heading text may have inline markdown.

Setext style headings are **not** supported.

### Block Quotes.

A block quote is one or more lines starting with a `>` character and optionally followed by a space. For example:

```
> This is a block quote
> which contains a list
> 1) one
> 2) two
> 3) three
>
>> Block quotes can contain any markdown.
Block quotes end when there is no > character starting the line.
```

The text inside the blockquote is parsed again, after the `>` and (optional) space is
removed from each line.

### Lists.
A *list* is a sequence of one or more *list items*. A *list item* is a line starting with
a *list marker*, followed by any number of blank or indented lines. This is different from most markdown, which allows unindented lines in a list item. My feeling is that
unindented lines make the list less readable.

The *list marker* for an unordered list is either `+` or `*` or `-`, followed by one
space. The *list marker* for an ordered list is either a number, or a letter, or a roman numeral, followed by `)` or `.`, and then one space. If the list marker style changes,
a new list starts. For ordered lists, the first number or letter starts the numbering of the list.

Some examples:
```
* an
* unordered
* list
1. an 
2. ordered 
2. list. The only numeral that matters is the first.

1. this orderd list
2. starts with one style
a. but when the style changes, a
b. new list is started.
```

Lists may be *tight* or *loose*. The lists above are tight, because they do not have any
blank lines between the items. A loose list has blank lines between some of the list items. A loose list promotes the text inside to paragraphs.

The content of each list item is parsed again, so any markdown is allowed in lists, including e.g. other lists, tables, etc. Before being re-parsed, the list marker is removed and all following lines are dedented by the minimum indentation in the following
lines (or the indentation implied by the list marker).

### Code Blocks.
Code blocks come in two varieties: indented or fenced. An indented code block is
a block of text indented by four or more spaces, or 1 or more tabs. A fenced code block
is a code block which starts with a "fence" of three backticks and ends with a fence of
three backticks. The first fence can be followed by text, which is the codeblock label.
Mostly this label is the computer language being used in the code block, but it can also be used as a simple extension mechanism. 

Two labels known to scratchmark are `omit` and `verbatim`. An `omit` fenced block is simply left out of the document. A `verbatim` block is passed through unchanged.

Examples:
````
    an indented
    code block

```javascript
a fenced code block, which is supposed to contain javascript
```

```omit
This line and the surrounding fences won't appear in the final document
```
````
Nothing inside a code block is parsed further. If you need to escape a fence
inside a fenced block, start the line with a '\\' character.

### Horizontal Rules.
A horizontal rule is a line starting with `---` or `+++` or `___`. The rest of the
line is ignored. Spaces between the markers are not accepted.

### Tables.
A table is one or more lines which must start with a `|` character. Each line is a row of the table, and the ends of cells in the row are marked with `|` characters. That is,
the `|` character starts and ends the table row, and separates the cells within it.

You can define column alignment by using column alignment markers in the first or second row.
A column alignment marker is a cell with either `:---` (left justified), `---:` 
(right justified), `:---:` (centred), or `---` (default, usually left justified) in it.
The alignment markers can have any number of dashes, and may be preceded and followed by spaces.

1. If the first row has the column alignment markers, the table has no header.
2. If the second row has the column alignment markers, the first row becomes the table
   header.
3. If neither row has the alignment markers, there is no header and the table is
   given default column alignment.


### Links.
There are two link styles: *inline* and *reference*. In both cases the link text is enclosed in square brackets and the link address in round brackets following it. An example of an inline link is
```
This is a [link to google](http://www.google.co.uk)
```
In a reference link, the address is replaced by a reference, which is defined elsewhere:
```
This is a [link to google](goog)

[goog]: http://www.google.co.uk
```

That's different from Markdown, which encloses link references in square brackets. 

You can put any inline content in the link text, e.g. images, bold, etc.

If the link text is the same as the link address, leave the text out, like `[](http://a.b.com)`. This also works for references.

Titles are not implemented but should be.

### Images.
An image is an exclamation mark, followed by the alt-text in square brackets, followed by the image URL in round brackets. The image URL can be a reference just like the reference-style links.

Examples:
```
![Alt text](/path/to/img.jpg)

![Alt text](imgurl)

[imgurl]: /path/to/img.jpg
```

### HTML.
An HTML tag or doctype declaration on a line by itself is passed through unchanged. An html tag as part of text is passed through unchanged. Everything in a SCRIPT or HEAD tag or comment is passed through unchanged.

### Span styles: **, *, __, _, and more.
If text is surrounded by start and end `**` or `__`, it is marked as strong.

If text is surrounded by start and end `*` or `_`, it is emphasized.

If text is surrounded by backticks, it is code.

If text is surrounded by start and end `^`, it is superscript.

If text is surrounded by start and end `~`, it is subscripted.

All these styles can be nested at will. If the end marker is accidentally missed out, it is inserted at the end of a paragraph or text section, just like HTML would deal with it.

## Extensions.

### Attributes.
You can add HTML attributes to markdown elements by putting them in curly brackets afterwards. There are three types of attribute:

1. `{: name=value name=value ...}` attaches the attributes to the previous element.
1. `{.classname}` attaches the given classname to the previous element and is 
   equivalent to `{: class=classname}`.
2. `{#id}` attaches the id to the previous element and is equivalent to `{: id=id}`

When scratchmark comes across one of these, it looks back for the first sibling element 
and attaches the attributes to them. If there is no sibling element, it attaches the attributes to the parent element.

### Sections.
A section is a title line followed by any number of blank or indented lines. The
title line is text followed by a : (and possibly text after). There should be no spaces
in the text before the :

Section layout is customized by the title. One predefined section is `figure`. In
a figure section, the caption is marked by blockquotes.For example
```
figure:
   ![alt-text](img.png)

   > Figure: This caption should describe the figure
   > and can have many lines

This is not part of the section
```

In general, sections take the indented text (and text following the title if any), dedent
it, and then parse it again. The result is passed to the section handler which can re-interpret the syntax tree, as here where the blockquote is turned into a figcaption.

### Labels.
Labels are run as a preprocessor step, before markdown parsing. A label is defined
by `{group.name=}`and used by `{=group.name}`. The `group` defines an enumerated type, and the
`name` refers to one of its values (counting from 1). So for example, we can label figures as follows:
```
[alt text](src) {#figure{fig.x=}}

[This link](#figure{=fig.x}) takes you to the previous figure
```
After preprocessing this becomes
```
[alt text](src) {#figure1}

[This link](#figure1) takes you to the previous figure
```
if fig.x was the first label in the fig group.

### Maths.







