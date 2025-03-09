<table width=100% border=0>
<tr>
<td valign=top colspan=2>

## `ParserCollection`

A class which extends Array to add parser-related functionality


</td>
</tr>
<tr>
<td valign=top>


</td>
<td valign=top width=60%>

```javascript
class ParserCollection extends Array {
```

</td>
</tr>
<tr>
<td valign=top colspan=2>

### Method 'findname'
 called by method `add`

<dl>
<dt>

**Parameter**

</dt>
<dd>

`name`: the name of the parser to find

</dd>
</dl>

<dl>
<dt>

**Returns**

</dt>
<dd>

    the index of the blockparser with the given name, or -1 if
    not found


</dd>
</dl>


</td>
</tr>
<tr>
<td valign=top>


</td>
<td valign=top width=60%>

```javascript
    findname(name) {
        return this.findIndex((bp) => bp.name == name)
    }

```

</td>
</tr>
<tr>
<td valign=top colspan=2>

### Method `add`
adds a parser object to the collection

<dl>
<dt>

**Parameters**

</dt>
<dd>

`parser`: the parser object to add to the collection
`before`: the name of the parser it should run before


</dd>
</dl>

<dl>
<dt>

**Note**

</dt>
<dd>

  The `before` parameter is used if the parser needs to run
  before another one. This typically happens if the string
  this parser looks for is a superset of the before parser's string.


</dd>
</dl>


</td>
</tr>
<tr>
<td valign=top>


</td>
<td valign=top width=60%>

```javascript
    add(parser, before) {
        if (before) {
            let idx = this.findIndex((b) => b.name == before)
            if (idx == -1) {
                throw 'no block parser called ' + before
            }
            this.splice(idx, 0, parser)
        } else {
            this.push(parser)
        }
    }

```

</td>
</tr>
<tr>
<td valign=top colspan=2>

### Method `createKeys`
Creates an internal keyed store of parsers

<dl>
<dt>

**Parameters**

</dt>
<dd>

for historical reasons, there is one.


</dd>
</dl>

<dl>
<dt>

**Note**

</dt>
<dd>

   This builds a keyed object containing parsers
   listed by their characters in parser.startsWith.
   .startsWith is only defined if the only lines that
   could trigger the parser begin with a character in startsWith.


</dd>
</dl>


</td>
</tr>
<tr>
<td valign=top>


</td>
<td valign=top width=60%>

```javascript
    createKeys(property = 'startsWith') {
        let keyed = {},
            unkeyed = []
        for (let parser of this) {
```

</td>
</tr>
<tr>
<td valign=top>

get the startsWith property from the parser

</td>
<td valign=top width=60%>

```javascript
            let charlist = parser[property]
```

</td>
</tr>
<tr>
<td valign=top>

if it has no such property, it's put in the unkeyed list

</td>
<td valign=top width=60%>

```javascript
            if (!charlist || charlist.length == 0) {
                unkeyed.push(parser)
                continue
            }
```

</td>
</tr>
<tr>
<td valign=top>

If some of the characters in startsWith are already
claimed by another parser, we must allow this parser to
run as unkeyed

</td>
<td valign=top width=60%>

```javascript
            if ([...charlist].some((k) => keyed[k])) {
                unkeyed.push(parser)
            }
```

</td>
</tr>
<tr>
<td valign=top>

add the parser to the keyed collection for all characters in
startsWith that aren't already claimed by another parser.

</td>
<td valign=top width=60%>

```javascript
            for (let k of charlist) {
                keyed[k] ||= parser
            }
        }
```

</td>
</tr>
<tr>
<td valign=top>

set keyed and unkeyed on this collection

</td>
<td valign=top width=60%>

```javascript
        this.keyed = keyed
        this.unkeyed = unkeyed
    }
}

```

</td>
</tr>
<tr>
<td valign=top>

blockparsers contains all the block-level parsers

</td>
<td valign=top width=60%>

```javascript
let blockparsers = new ParserCollection(),
```

</td>
</tr>
<tr>
<td valign=top>

and inlineparsers contains all the inline-level parsers

</td>
<td valign=top width=60%>

```javascript
    inlineparsers = new ParserCollection()
window.blockparsers = blockparsers

```

</td>
</tr>
<tr>
<td valign=top colspan=2>


## `scratchmark`

<dl>
<dt>

**Parameters**

</dt>
<dd>

* **lines:**  a string
* **printer:**  if given, the output function.


</dd>
</dl>

<dl>
<dt>

**Returns**

</dt>
<dd>

    if printer is defined it returns printer(ast), where ast is
    an abstract syntax tree created by scratchmark. If not, it returns
    the ast.

    The ast is an array of nodes, of the form {name, attributes, children}


</dd>
</dl>


</td>
</tr>
<tr>
<td valign=top>


</td>
<td valign=top width=60%>

```javascript
function scratchmark(lines, printer) {
```

</td>
</tr>
<tr>
<td valign=top>

replace tabs, turn the string into an array of lines,
and trim them on the right hand side

</td>
<td valign=top width=60%>

```javascript
    lines = lines
        .replace('\t', '    ')
        .split(/\r?\n/)
        .map((l) => l.trimRight())

```

</td>
</tr>
<tr>
<td valign=top>

any line ending in \ is a line-continuation, so we have to join them.

</td>
<td valign=top width=60%>

```javascript
    let joined = [lines.shift()]
    for (let line of lines) {
        if (joined.at(-1).endsWith('\\')) {
            joined.push(joined.pop().slice(0, -1) + line)
        } else {
            joined.push(line)
        }
    }
    lines = joined

```

</td>
</tr>
<tr>
<td valign=top>

Initialize the parsers before the run

</td>
<td valign=top width=60%>

```javascript
    for (let block of blockparsers) {
        block?.init?.()
    }
    for (let inline of inlineparsers) {
        inline?.init?.()
    }

```

</td>
</tr>
<tr>
<td valign=top>

Sort out the parsers into keyed and unkeyed.

</td>
<td valign=top width=60%>

```javascript
    blockparsers.createKeys()

```

</td>
</tr>
<tr>
<td valign=top>

Run the actual parse. The blockparsers themselves are responsible for
calling the inline parsers.

</td>
<td valign=top width=60%>

```javascript
    let ast = parse_blocks(lines)

```

</td>
</tr>
<tr>
<td valign=top>

Do any post-processing

</td>
<td valign=top width=60%>

```javascript
    for (let inline of inlineparsers) {
        inline?.postprocess?.(ast)
    }
    for (let block of blockparsers) {
        block?.postprocess?.(ast)
    }

```

</td>
</tr>
<tr>
<td valign=top>

if there's a printer supplied, run the ast through it,
otherwise return the ast

</td>
<td valign=top width=60%>

```javascript
    return printer?.(ast) || ast
}

```

</td>
</tr>
<tr>
<td valign=top colspan=2>

## `parse_blocks`
Parse an array of strings into blocks, possibly recursively

<dl>
<dt>

**Parameter**

</dt>
<dd>

* **lines:**  an array of strings. These are right-trimmed


</dd>
</dl>

<dl>
<dt>

**Returns**

</dt>
<dd>

   ast: an array of nodes found by the block parsers.


</dd>
</dl>


</td>
</tr>
<tr>
<td valign=top>


</td>
<td valign=top width=60%>

```javascript
function parse_blocks(lines) {
```

</td>
</tr>
<tr>
<td valign=top>

text accummulates the text lines

</td>
<td valign=top width=60%>

```javascript
    let text = [],
        ast = []

```

</td>
</tr>
<tr>
<td valign=top>

iterate over the lines

</td>
<td valign=top width=60%>

```javascript
    while (lines.length > 0) {
        let node

```

</td>
</tr>
<tr>
<td valign=top>

Check if any keyed parser could be invoked on the line.

</td>
<td valign=top width=60%>

```javascript
        node = blockparsers.keyed[lines[0][0]]?.parse?.(lines, {
            parse_blocks,
            parse_inline,
        })

```

</td>
</tr>
<tr>
<td valign=top>

The keyed parser (if any) was not successful

</td>
<td valign=top width=60%>

```javascript
        if (!node) {
```

</td>
</tr>
<tr>
<td valign=top>

See if any unkeyed parser can recognize the line

</td>
<td valign=top width=60%>

```javascript
            for (let bp of blockparsers.unkeyed) {
                if (
                    (node = bp.parse(lines, {
                        parse_blocks,
                        parse_inline,
                    }))
                ) {
```

</td>
</tr>
<tr>
<td valign=top>

success - break out of the loop

</td>
<td valign=top width=60%>

```javascript
                    break
                }
            }
        }

```

</td>
</tr>
<tr>
<td valign=top>

if node exists the parse succeeded

</td>
<td valign=top width=60%>

```javascript
        if (node) {
```

</td>
</tr>
<tr>
<td valign=top>

Non-omitted nodes get put in the ast

</td>
<td valign=top width=60%>

```javascript
            if (node.name != 'omit') {
```

</td>
</tr>
<tr>
<td valign=top>

first, push any existing text accummulated earlier
onto the ast. This is not a paragraph because it
ended with a node, not a blank.

</td>
<td valign=top width=60%>

```javascript
                push_text('textblock')
```

</td>
</tr>
<tr>
<td valign=top>

push the new node on the ast list

</td>
<td valign=top width=60%>

```javascript
                ast.push(node)
            }
        } else {
```

</td>
</tr>
<tr>
<td valign=top>

the parse failed, so the current line is regular text.
Blank lines can trigger a paragraph

</td>
<td valign=top width=60%>

```javascript
            if (blankline(lines[0])) {
```

</td>
</tr>
<tr>
<td valign=top>

if we already have lines of text, the
 blank creates a paragraph

</td>
<td valign=top width=60%>

```javascript
                if (text.length > 0) {
                    text.push(lines.shift())
                    push_text('p')
```

</td>
</tr>
<tr>
<td valign=top>

otherwise, we just push the blank onto the ast as a
terminal text node.

</td>
<td valign=top width=60%>

```javascript
                } else {
                    ast.push({ name: 'text', text: lines.shift() })
                }
```

</td>
</tr>
<tr>
<td valign=top>

if not blank, we add it to the lines of text

</td>
<td valign=top width=60%>

```javascript
            } else {
                text.push(lines.shift())
            }
        }
    }

```

</td>
</tr>
<tr>
<td valign=top>

any remaining text lines are pushed onto the ast

</td>
<td valign=top width=60%>

```javascript
    text.length > 0 && push_text('textblock')

    return ast

```

</td>
</tr>
<tr>
<td valign=top>

push_text takes the existing array of text lines,
runs the inline parser, and pushes the result onto the
ast.

</td>
<td valign=top width=60%>

```javascript
    function push_text(name) {
        let children = parse_inline(text)
```

</td>
</tr>
<tr>
<td valign=top>

paragraphs form a single node with children

</td>
<td valign=top width=60%>

```javascript
        if (name == 'p') {
            ast.push({ name, children })
```

</td>
</tr>
<tr>
<td valign=top>

textblocks aren't a node, so their children
get pushed onto the ast

</td>
<td valign=top width=60%>

```javascript
        } else {
            ast.push(...children)
        }
        text = []
    }
}

```

</td>
</tr>
<tr>
<td valign=top colspan=2>

## `MutableString` class
A MutableString acts like a string that can be changed



</td>
</tr>
<tr>
<td valign=top>


</td>
<td valign=top width=60%>

```javascript
class MutableString {
    constructor(value) {
        this.value = value
        this.lookbehind = ''
        Object.defineProperty(this, 'length', {
            get() {
                return this.value.length
            },
        })
    }
    set(value) {
        this.value = value
    }
    startsWith(str) {
```

</td>
</tr>
<tr>
<td valign=top>

this avoids escaped strings

</td>
<td valign=top width=60%>

```javascript
        return this.lookbehind != '\\' && this.value.startsWith(str)
    }
    match(...args) {
        return this.lookbehind != '\\' && this.value.match(...args)
    }
    indexOf(str, start = 0) {
```

</td>
</tr>
<tr>
<td valign=top>

unescaped only

</td>
<td valign=top width=60%>

```javascript
        let idx
        while ((idx = this.value.indexOf(str, start))) {
            if (idx == -1) {
                return idx
            }
            if (this.value[idx - 1] != '\\') {
                return idx
            }
            start = idx + 1
        }
    }
    eat(count) {
```

</td>
</tr>
<tr>
<td valign=top>

removes and returns count characters from the start of the value

</td>
<td valign=top width=60%>

```javascript
        let result = this.value.slice(0, count)
        this.lookbehind = result.at(-1)
        this.value = this.value.slice(count)
        return result
    }
}

```

</td>
</tr>
<tr>
<td valign=top colspan=2>

## `parse_inline`
Runs the inline parsers

<dl>
<dt>

**Parameters**

</dt>
<dd>

* **text:**  the string of text to parse. We should ensure it's a MutableString
* **endsWith:**  a set of characters to terminate the parse.


</dd>
</dl>

<dl>
<dt>

**Returns**

</dt>
<dd>

   an array of nodes



</dd>
</dl>


</td>
</tr>
<tr>
<td valign=top>


</td>
<td valign=top width=60%>

```javascript
function parse_inline(text, endsWith) {
```

</td>
</tr>
<tr>
<td valign=top>

if line is an array or string, it's converted to a MutableString

</td>
<td valign=top width=60%>

```javascript
    if (Array.isArray(text)) {
        text = text.join('\n') + '\n'
    }
    if (text.constructor != MutableString) {
        text = new MutableString(text)
    }

```

</td>
</tr>
<tr>
<td valign=top>

ast is the array of nodes

</td>
<td valign=top width=60%>

```javascript
    let ast = [],
```

</td>
</tr>
<tr>
<td valign=top>

textstring accumulates characters that aren't in another node.

</td>
<td valign=top width=60%>

```javascript
        textstring = ''

    while (text.length > 0 && !text.startsWith(endsWith)) {
```

</td>
</tr>
<tr>
<td valign=top>

node holds the successfully parsed node if any

</td>
<td valign=top width=60%>

```javascript
        let node
```

</td>
</tr>
<tr>
<td valign=top>

check each inline parser in turn. NB can't
use the keyed trick here because of escaped characters

</td>
<td valign=top width=60%>

```javascript
        for (let inline of inlineparsers) {
```

</td>
</tr>
<tr>
<td valign=top>

check if the text starts with the string needed by the parser
text.startsWith does a lookbehind to avoid escaped characters.

</td>
<td valign=top width=60%>

```javascript
            if (text.startsWith(inline.startsWith)) {
```

</td>
</tr>
<tr>
<td valign=top>

run the parser, which may fail

</td>
<td valign=top width=60%>

```javascript
                node = inline.parser(text, parse_inline)
```

</td>
</tr>
<tr>
<td valign=top>

the parse succeeds if node exists

</td>
<td valign=top width=60%>

```javascript
                if (node) {
```

</td>
</tr>
<tr>
<td valign=top>

omitted nodes do nothing to the ast

</td>
<td valign=top width=60%>

```javascript
                    if (node.name != 'omit') {
```

</td>
</tr>
<tr>
<td valign=top>

push the existing text string onto the ast

</td>
<td valign=top width=60%>

```javascript
                        if (textstring.length > 0) {
                            ast.push({ name: 'text', text: textstring })
                            textstring = ''
                        }
```

</td>
</tr>
<tr>
<td valign=top>

push the node onto the ast

</td>
<td valign=top width=60%>

```javascript
                        ast.push(node)
                    }
                    break
                }
            }
        }
```

</td>
</tr>
<tr>
<td valign=top>

If the parse failed, we accumulate the text string

</td>
<td valign=top width=60%>

```javascript
        if (!node) {
            textstring += text.eat(1)
        }
    }
```

</td>
</tr>
<tr>
<td valign=top>

push any outstanding text onto the ast

</td>
<td valign=top width=60%>

```javascript
    if (textstring.length > 0) {
        ast.push({ name: 'text', text: textstring })
    }

    return ast
}

function blankline(line) {
    return line != undefined && line.match(/^ *$/)
}

function astprinter(ast, indent = '', incr = '    ') {
```

</td>
</tr>
<tr>
<td valign=top>

prints the ast simply to the console

</td>
<td valign=top width=60%>

```javascript
    for (let node of ast) {
        switch (node.name) {
            case 'text':
                console.log(
                    `"${node.text
                        .split('\n')
                        .map((t) => indent + t)
                        .join('\n')}"`
                )
                break
            default:
                console.log(indent + node.name + ':')
                node.children && astprinter(node.children, indent + incr)
        }
    }
    return ast
}

```

</td>
</tr>
</table>
