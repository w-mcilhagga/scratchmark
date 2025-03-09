/** ## Block Parsing Implementation.
 *
 * Blocks are parsed line-by-line using block-level parsers. A block level parser is an
 * object with a `name` and `parse` and optionally `init` and `postprocess`
 *
 * `name` is a string which identifies the parser, and is often the name of the node it creates.
 *
 * `parse` is a function with signature `parse(lines, {parse_blocks, parse_inline})`. The \parameters are:
 * * `lines`: the array of lines making up the document, where `lines[0]` is the current line.
 * * `parse_blocks`: a function which takes an array of lines and returns a markdown ast.
 * * `parse_inline`: a function which takes a string and returns a markdown ast.
 *
 * The latter two parameters are for when block parsers need to invoke parsing to finish. For example,
 * the heading parser invokes `parse_inline` on the line of thes after the heading markers.
 *
 * If `parse` succeeds, it alters the `lines` array, removing those lines that matched the parse, and returns the
 * markdown ast that was generated. A markdown ast is an array of nodes; each node is an object
 * `{name, attributes, children}` where `name` is the node name, `attributes` optionally gives HTML attributes
 * for the node, and `children` is a markdown ast.
 *
 * If `parse` fails, it should leave the `lines` array unchanged and return `false`.
 *
 * `init`, if supplied, is called before parsing to do setup as needed. It takes no parameters
 *
 * `postprocess`, if supplied, is called after parsing to perform any followup actions. It takes the
 * markdown ast and returns it, possibly changed.
 *
 * ---
 */

/** ### Headers
 *
 * A header starts with 1 to 6 `#` characters followed by a space, then the header text. If the text goes over
 * more than one line, use a line continuation (a backslash). The header text is passed to the `inline_parse`
 * function.
 *
 * Only atx-style headers are supported, because Setext headers look ugly.
 *
 * #### Examples
 * ```
 * # This is a level 1 header.
 * ## This is level 2.
 * ###This isn't a header because there is no space between the # and the text.
 * ####### This isn't a header because it has 7 # marks
 * \# This isn't a header because the # has been escaped.
 * ```
 *
 * Headers can be closed with #s as well.
 */

blockparsers.add({
    name: 'header',
    re: /^#{1,6} /,
    parse(lines, { parse_inline }) {
        let prefix = lines[0].match(this.re)?.[0]
        if (prefix) {
            // remove the matching line & cut off prefix
            let line = lines.shift().slice(prefix.length)
            // remove trailing # if any
            line = line.replace(/#+$/, '')
            // return a node with name h1...h6.
            return {
                name: 'h' + (prefix.length - 1),
                children: parse_inline(line),
            }
        }
    },
})

/** ### Block Quote
 *
 * A block quote is a set of lines starting with '>' and (optionally) one space.
 *
 * #### Example
 * ```
 * > This is a block quote
 * > You can put other block level elements inside it like
 * >* lists
 * >* tables
 * >* other block quotes
 * This line isn't part of the quote.
 * ```
 *
 * The lines of text following the '>' are dedented up to 1 space and passed to `parse_blocks`
 * so any block level element can be quoted..
 */

blockparsers.add({
    name: 'blockquote',
    parse(lines, { parse_blocks }) {
        // collect all lines starting with '>'
        let quoted = grablines(lines, (line) => line.startsWith('>'))
        if (quoted.length > 0) {
            quoted = quoted.map((line) => line.replace(/^> ?/, ''))
            return {
                name: 'blockquote',
                children: parse_blocks(quoted),
            }
        }
    },
})

/** ### Indented Codeblock
 *
 * A series of lines starting with *at least* four spaces is
 * considered a code block.
 */

blockparsers.add({
    name: 'indented_codeblock',
    parse(lines) {
        let block = grablines(lines, (line) => line.startsWith('    '))
        if (block.length > 0) {
            return {
                name: 'codeblock',
                children: block.map((c) => ({
                    name: 'text',
                    text: c.replace(/^    /, ''),
                })),
            }
        }
    },
})

/** ### Fenced Codeblock
 *
 * Any set of lines between a line starting with `\`\`\`` and ending on a subsequent line
 * starting with `\`\`\`` is considered a code block.
 *
 * The first `\`\`\`` fence may be followed by a type (e.g. the programming language).
 *
 * The fence type provides a simple extension mechanism. If there is a fence handler defined
 * for that type, the code block is passed through it. Otherwise, the code block
 * is turned  into text lines.
 *
 * Currently, there are two fence types:
 * * `omit`: all text between the fences is left out of the document
 * * `verbatim`: all text between the fences is passed through unchanged.
 *
 * #### Example
 * ```
 * \```
 * function twentythree() {
 *      return 23
 * }
 * \```
 * ```
 */

blockparsers.add({
    name: 'fenced_codeblock',
    init() {
        for (let handler in fencehandler) {
            fencehandler[handler].init?.()
        }
    },
    postprocess(ast) {
        for (let handler in fencehandler) {
            fencehandler[handler].postprocess?.(ast)
        }
    },
    parse(lines) {
        if (lines[0]?.startsWith('```')) {
            let fence = lines.shift(), // shifts off the first fence
                type = fence.slice(3), // gets the type from the first fence
                block = grablines(lines, (line) => !line.startsWith('```'))
            // remove the last fence, which isn't in block.
            // If no last fence, all lines are grabbed.
            lines.shift()
            // pass the node through a handler as a way of getting simple extensions.
            return (
                fencehandler[type]?.parse?.(children) || {
                    name: 'codeblock',
                    type,
                    // we only remove escapes in front of fences within the code block
                    children: block.map((c) => ({
                        name: 'text',
                        text: c.replace(/^\\```/, '```'),
                    })),
                }
            )
        }
    },
})

let fencehandler = {},
    config = {}

// config fence sets some properties on the global config object
fencehandler.config = {
    init: function () {
        config = {}
    },
    parse: function (lines) {
        for (let line of lines) {
            let [name, value] = line.split(':').map((c) => c.trim())
            config[name] = isNaN(+value) ? value : +value
        }
        return { name: 'omit' }
    },
}

fencehandler.verbatim = {
    parse: function (lines) {
        return {
            name: 'verbatim',
            children: lines.map((c) => ({ name: 'text', text: c })),
        }
    },
}

fencehandler.omit = {
    parse: function (lines) {
        return {
            name: 'omit',
        }
    },
}

/** ### Unordered Lists
 *
 * An unordered list consists of a series of list items. Each item
 * has one line starting with list marker, either `*` or `+` or `-`. It can
 * be followed by any number of indented lines or blanks.
 *
 * The list item ends when a **non-indented** line is encountered (which may be the next
 * list item).This indentation requirement is more strict than standard markdown.
 *
 * If the list marker changes, a new list is started.
 *
 * If one or more blank lines separate list items, or there are blank lines within a
 * list item, the list is "loose" - text blocks become paragraphs within the list.
 *
 * The contents of each list item are passed to `parse_blocks` after being dedented, so any
 * block-level element can appear in a list item. The dedent is the minimum of the indent of the
 * second line in a list item (if any) or 2.
 *
 * #### Examples
 * 1) The following will produce a single list:
 *  ```
 *  * one
 *  * two
 *  * three
 *  ```
 * 2) The following will produce two lists because the list marker changes
 *  ```
 *  * one
 *  * two
 *  - three
 *  - four
 *  ```
 *
 * 3) Indentation is quite strict:
 *  ```
 *  * this is the first item
 *   in the list, where the second line has been indented
 *  * this is the second item
 *  but this line isn't in the list, because it's not indented.
 *  ```
 *
 */
blockparsers.add({
    name: 'unordered_list',
    re: /^[+*-] /,
    parse(lines, { parse_blocks }) {
        let items = [],
            item,
            marker,
            checkmarker = (prefix) => !marker || prefix[0] == marker
        // an unordered list is just a list of items of the
        // right type.
        while ((item = list_item(lines, this.re, checkmarker))) {
            // check that it is the same style as the last one
            marker ||= item.prefix[0]
            // otherwise, this is a good list item
            items.push(item)
        }
        if (items.length > 0) {
            // we have a list
            deblank(items, lines)
            dedent(items)
            checkloose(items)
            // recurse
            items = items.map((item) => item.lines)
            items = items.map(parse_blocks)
            let ulclass = { '*': 'star-list', '+': 'plus-list', '-': 'minus-list' }
            return {
                name: 'ul',
                attributes: {
                    class: ulclass[marker],
                },
                children: items.map((children) => ({ name: 'li', children })),
            }
        }
    },
})

/** ### Ordered Lists
 *
 * An ordered list consists of a series of list items. Each item
 * has one line starting with list marker. It can
 * be followed by any number of indented lines or blanks.
 *
 * Ordered list markers are a number or lower case letter or roman numeral, followed by
 * a `)` or a `.`. The first number in the list says where the list starts from.
 *
 * The list item ends when a **non-indented** line is encountered (which may be the next
 * list item).This indentation requirement is more strict than standard markdown.
 *
 * If the list marker changes, a new list is started.
 *
 * If one or more blank lines separate list items, or there are blank lines within a
 * list item, the list is "loose" - text blocks become paragraphs within the list.
 *
 * The contents of each list item are passed to `parse_blocks` after being dedented, so any
 * block-level element can appear in a list item. The dedent is the minimum of the indent of the
 * second line in a list item (if any) or 2.
 *
 * #### Examples
 * 1) The following will produce a single list:
 *  ```
 *  1. one
 *  2. two
 *  3. three
 *  ```
 * 2) The following will produce three lists because the list marker changes in some way.
 *  ```
 *  1. one
 *  2. two
 *  3) three
 *  4) four
 *  a) five
 *  b) six
 *  ```
 * 3) The following list will start at 3
 * ```
 * 3) three
 * 3) four (the actual numeral doesn't matter in subsequent elements)
 * 3) five.
 * ```
 */

blockparsers.add({
    name: 'ordered_list',
    re: /^[0-9a-zMCXIV]+[).] /,
    parse(lines, { parse_blocks }) {
        let items = [],
            item,
            style,
            checkmarker = (prefix) => !style || getstyle(prefix) == style
        while ((item = list_item(lines, this.re, checkmarker))) {
            // classify list type
            style ||= getstyle(item.prefix)
            items.push(item)
        }
        // if we've collected some items, we process them further
        if (items.length > 0) {
            let start = items[0].prefix.slice(0, -2)
            // we have a list
            deblank(items, lines)
            dedent(items)
            checkloose(items)
            // recurse
            items = items.map((item) => item.lines)
            items = items.map(parse_blocks)
            return {
                name: 'ol',
                attributes: {
                    start,
                    type: style.slice(0, -1),
                },
                children: items.map((children) => ({ name: 'li', children })),
            }
        }

        function getstyle(prefix) {
            let orderstyle,
                endmarker = prefix.at(-2)
            if ('0123456789'.includes(prefix[0])) {
                orderstyle = '1'
            } else if ('IVMXL'.includes(prefix[0])) {
                // c & C left out.
                orderstyle = 'I'
            } else if ('ivmxl'.includes(prefix[0])) {
                // c & C left out.
                orderstyle = 'i'
            } else if ('ABCDEFGHIJK'.includes(prefix[0])) {
                orderstyle = 'A'
            } else {
                orderstyle = 'a'
            }
            return orderstyle + endmarker
        }
    },
})

// dedent the list items by the number of spaces equal to
// the length of each list item prefix or the minimum indentation of following lines,
// whichever is least
function dedent(items) {
    for (let item of items) {
        // we know there is at least one line, so lines[0] is ok
        item.lines[0] = item.lines[0].slice(item.prefix.length) // removes '* ' or '1) ' etc.
        // the dedent is based on the minimum indentation
        let i = 1,
            len = item.prefix.length
        // possible indentation from other lines
        for (let line of item.lines.slice(1)) {
            if (!blankline(line)) {
                len = Math.min(len, line.match(/^ +/)[0].length)
            }
        }
        let re = new RegExp(`^ {0,${len || 1}}`)
        for (let i = 1; i < item.lines.length; i++) {
            item.lines[i] = item.lines[i].replace(re, '')
        }
    }
}

// a list is loose if a) there are blanks between the list elements
// or b) there are blanks within the list elements. c) any of the children aren't
// text - this would have to wait until after recursion.
function checkloose(items) {
    loose = false
    for (let item of items) {
        if (item.lines.some((line) => blankline(line))) {
            loose = true
            break
        }
    }
    if (loose) {
        for (let item of items) {
            if (!blankline(item.lines.at(-1))) {
                // will turn last text block (if any) into a paragraph
                item.lines.push('')
            }
        }
    }
}

// move blank lines from the last list item back onto the input
function deblank(items, lines) {
    if (items.length > 1) {
        while (blankline(items.at(-1).lines.at?.(-1))) {
            lines.unshift(items.at(-1).lines.pop())
        }
    }
}

function list_item(lines, regex, check) {
    // finds the lines that correspond to a list item
    // begining with the regex. Returns the item prefix and
    // the number of lines in the item.
    let prefix = lines[0]?.match(regex)?.[0]
    // if prefix passes the style check, we have a list item
    if (prefix && check(prefix)) {
        let children = [
            lines.shift(),
            ...grablines(lines, (line) => indented(line) || blankline(line)),
        ]
        return { prefix, lines: children }
    }
}

/** ### Horizontal Rule
 *
 * Any line starting with `---`, `***`, or `___` causes a horizontal rule.
 * Spaces aren't allowed e.g. `- - -` isn't a horizontal rule. Who does this anyway?
 * Any text following the line marking is ignored.
 */
blockparsers.add({
    name: 'horizontal_rule',
    parse(lines) {
        if (
            lines[0].startsWith('***') ||
            lines[0].startsWith('---') ||
            lines[0].startsWith('___')
        ) {
            lines.shift()
            // maybe allow an attribute {...} on the same line?
            return {
                name: 'hr',
            }
        }
    },
})

/** ### Footnote Definition
 *
 * Footnotes consist of two parts - a citation, which is an inline element, and a
 * definition.
 * A footnote definition is a line beginning with `[^label]:` followed by
 * any number of indented or blank lines. The etxt is passed to the `parse_blocks` routine so any
 * block-level elements can be in a footnote.
 *
 * #### Example
 * ```
 * [^abc]: This is a footnote. There should be a citation to it like[^abc] somewhere in the text.
 * ```
 *
 * Footnotes are collected at the bottom of the HTML document, regardless of where they are
 * written in the markdown document. They are ordered according to the order of the citations; the
 * actual footnote label doesn't matter.
 */
blockparsers.add({
    name: 'footnote_def',
    defs: {}, // the set of footnote definitions, keyed by id
    cites: [], // a list of footnote citations, in document order
    init() {
        this.defs = {}
        this.cites = [] // set by inline footnotes
    },
    // the regular expression to recognize a footnote
    re: /^\[\^[a-zA-Z0-9]+\]: */,
    parse(lines, { parse_blocks }) {
        let prefix = lines[0].match(this.re)?.[0]
        if (prefix) {
            // collect all lines, dedent them, and then turn into an ordered list item.
            let note = prefix.trim().slice(2, -2),
                children = [
                    lines.shift(),
                    ...grablines(lines, (line) => blankline(line) || indented(line)),
                ]
            // dedent the lines
            let re = new RegExp(`^ {0,${prefix.length}}`)
            children = children.map((c) => c.replace(re, ''))
            children[0] = children[0].slice(prefix.length)
            // convert the footnote into an ordered list item, for subsequent processing.
            children = children.map((c) => '   ' + c)
            children[0] = '1) ' + children[0].slice(3)
            this.defs[note] = children
            // the node is a placeholder to show success.
            return {
                name: 'omit',
            }
        }
    },
    postprocess(ast, { parse_blocks }) {
        // make all the definitions and citations numeric.
        // Ordering follows the order of the citations.
        let i = 1,
            tonumbers = {}
        for (let cite of this.cites) {
            if (!tonumbers[cite.key]) {
                tonumbers[cite.key] = i++
            }
            cite.key = tonumbers[cite.key]
            cite.attributes.href = `#footnote_${cite.key}`
            cite.children[0].text = '' + cite.key
        }
        // switch key/value of tonumbers
        tonumbers = Object.fromEntries(
            Object.entries(tonumbers).map((c) => c.toReversed())
        )
        // create the defs as a list
        let defs = []
        for (let j = 1; j < i; j++) {
            defs.push(...this.defs[tonumbers[j]])
        }
        defs = parse_blocks(defs)
        if (defs.length > 0) {
            for (let i = 0; i < defs[0].children.length; i++) {
                defs[0].children[i].attributes = { id: 'footnote_' + (i + 1) }
            }
            ast.push({
                name: 'div',
                attributes: { class: 'footnotes' },
                children: [defs],
            })
        }
    },
})

/** ### href Definition
 *
 * A href definition is a line beginning [number]: It has an address and an optional title
 *
 */
blockparsers.add({
    name: 'href_def',
    defs: {}, // a set of URL definitions, by id
    links: [], // a list of link references.
    init() {
        // holds all the definitions
        this.defs = {}
        this.links = []
    },
    re: /^\[[A-Za-z0-9]+\]: */,
    parse(lines) {
        let prefix = lines[0].match(this.re)?.[0]
        if (prefix) {
            note = prefix.slice(1).replace(/\]: *$/, '')
            let children = lines.splice(0, 1)
            children[0] = children[0].slice(prefix.length)
            this.defs[note] = children[0]
            return {
                name: 'omit',
            }
        }
    },
    postprocess(ast) {
        for (let node of this.links) {
            if (node.attributes.href) {
                node.attributes.href =
                    this.defs[node.attributes.href] || node.attributes.href
            } else {
                node.attributes.src =
                    this.defs[node.attributes.src] || node.attributes.src
            }
        }
    },
})

/** ### SCRIPT, HEAD, DOCTYPE, and HTML comments
 *
 * These tags are passed through verbatim. This allows you to
 * put markdown inside an html doc & process the markdown in the body.
 */

blockparsers.add({
    name: 'html_groups',
    re: /^<(script|head|!--|!doctype)/i,
    parse(lines, parsers) {
        let prefix = lines[0].match(this.re)?.[0]
        if (prefix) {
            prefix = prefix.toLowerCase()
            let close_tag
            if (prefix == '<!--') {
                close_tag = '-->'
            } else if (prefix == '<!doctype') {
                close_tag = '>'
            } else {
                close_tag = '</' + prefix.slice(1) + '>'
            }
            let children = grablines(lines, (line) => line.indexOf(close_tag) == -1)
            // the next line (which may be lines[0]) has the close tag
            children.push(lines.shift())
            return {
                name: 'verbatim',
                children,
            }
        }
    },
})

/** ### Other HTML tags
 *
 * These tags are passed through verbatim. They must be alone on the line
 * They are at block level so other block elements can be put in them, and they don't end up
 * accidentally being included in a p or textnode element.
 */
blockparsers.add({
    name: 'html_tags',
    re: /^<\/?[^>]*>$/, // trailing blanks not needed because line is right trimmed
    parse(lines) {
        if (lines[0]?.match(this.re)) {
            return {
                name: 'verbatim',
                children: lines.splice(0, 1),
            }
        }
    },
})

/** ### Tables
 *
 * A table is a series of rows. A row is chunks of text separated by | and bookended by them too.
 * If the second row of the table is |:-- etc, then a header row is created.
 *
 * The start and end | must be included too. any text after the last | is ignored.
 */
blockparsers.add({
    name: 'table',
    parse(lines, { parse_inline }) {
        let rows = [],
            row,
            rowcount = 0,
            alignment = []
        while ((row = this.row(lines[0], parse_inline, rowcount + 1))) {
            rowcount++
            lines.shift()
            if (!row.name) {
                alignment = row
            } else {
                rows.push(row)
            }
        }
        if (rows.length == 0) {
            return false
        }
        if (alignment.length > 0) {
            // set up alignment styles
            for (let row of rows) {
                for (let i = 0; i < alignment.length; i++) {
                    if (alignment[i] && row.children[i]) {
                        row.children[i].attributes = {
                            style: `text-align:${alignment[i]}`,
                        }
                    }
                }
            }
            // first row is header
            for (let c of rows[0].children) {
                c.name = 'th'
            }
            return {
                name: 'table',
                children: [
                    { name: 'thead', children: [rows[0]] },
                    {
                        name: 'tbody',
                        children: rows.slice(1),
                    },
                ],
            }
        } else {
            return {
                name: 'table',
                children: [
                    {
                        name: 'tbody',
                        children: rows,
                    },
                ],
            }
        }
    },
    row(line, parse_inline, number) {
        if (line?.startsWith?.('|')) {
            let cols = line.split('|').slice(1, -1)
            // check for an alignment row & return alignment as needed
            if (number == 2 && cols.every((c) => c && c.match(/^ *:?-+:? *$/))) {
                return cols.map((c) => {
                    let L = c.match(/^ *:-+/), // colon then at least one -
                        R = c.match(/-+: *$/) // at least one - then colon
                    if (L && R) {
                        return 'center'
                    }
                    if (L) {
                        return 'left'
                    }
                    if (R) {
                        return 'right'
                    }
                    return ''
                })
            }
            return {
                name: 'tr',
                children: cols.map((c) => ({
                    name: 'td',
                    children: parse_inline(c),
                })),
            }
        }
    },
})
