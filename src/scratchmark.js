/** # Scratchmark - a markdown parser
 *
 * Usage:
 *   Include scratchmark.js in a script tag:
 *   ```
 *   <script src='path/to/scratchmark.js'></script>
 *   <script>
 *   let {scratchmark} = md
 *   let html_string = scratchmark(markdown_string)
 *   </script>
 *   ```
 *
 * The script creates a global object with the following properties:
 *
 * `scratchmark`: a function which takes a markdown string and returns
 *    an HTML string. `scratchmark` takes two parameters:
 *    * `lines`: a string containing markdown.
 *    * `printer`: (optional) a function which takes a markdown syntax tree
 *       and converts it to some desired output string. If not supplied, it defaults
 *       to `html_printer`. If you want to see the markdown syntax tree,
 *       pass `(tree) => tree` as the printer.
 *
 * `config` : a config object that can be filled in with a config fence.
 *
 * `preprocessors`: for adding any preprocessor extensions.
 *
 * `blockparsers, inlineparsers`: arrays for adding markdown extensions
 *
 * `grablines, blankline, indented, delimited, capture, dedent`: functions useful
 *    for making markdown extensions.
 *
 * `html_printer`: the html_printer which takes a markdown syntax tree and returns
 *    an HTML string.
 *
 * `printers`: an object which stores the tag printers used by html_printers, useful
 *    when making markdown extensions.
 *
 */

let md = (function () {
    /* ## `ParserCollection`
     *
     * A class which extends Array to hold a set of block level or inline parsers.
     * A parser must have **at a minimum** a `name` property to be stored in a
     * parser collection.
     */
    class ParserCollection extends Array {
        constructor() {
            super()
            // `.byname` holds parsers by their name
            this.byname = {}
        }

        /* ### Method `add`
         * adds a parser object to the collection
         *
         * Parameters:
         *   `parser`: the parser object to add to the collection
         *   `before`: (optional) the name of the parser it should run before
         *
         * Note:
         *   The order of parsers can matter
         */
        add(parser, before) {
            if (before) {
                let idx = this.findIndex((b) => b.name == before)
                if (idx == -1) {
                    throw 'no parser called ' + before
                }
                this.splice(idx, 0, parser)
            } else {
                this.push(parser)
            }
            this.byname[parser.name] = parser
        }
    }

    // blockparsers contains all the block-level parsers
    let blockparsers = new ParserCollection(),
        // inlineparsers contains all the inline-level parsers
        inlineparsers = new ParserCollection(),
        // preprocessors contains all the preprocessors
        preprocessors = [],
        // config is filled in by a config fence
        config = {}

    /*
     * ## `scratchmark`
     * Parses a markdown string and returns the markdown ast or an html string.
     *
     * Parameters:
     *      lines: a string
     *      printer: (optional) the output function. Defaults to html_printer.
     *
     * Returns:
     *     if `printer` is defined, `scratchmark` returns `printer(ast)`, where ast is
     *     an abstract syntax tree created internally by scratchmark.
     *
     *     The ast is an array of nodes, which are objects `{name, attributes, children}`.
     *     `children` is an array of nodes
     */
    function scratchmark(lines, printer) {
        // replace tabs, turn the string into an array of lines,
        // and trim them on the right hand side.
        lines = lines
            .replace('\t', '    ')
            .split(/\r?\n/)
            .map((l) => l.trimRight())

        // any line ending in \ is a line-continuation, so we have to join them.
        let joined = [lines.shift()]
        for (let line of lines) {
            if (joined.at(-1).endsWith('\\')) {
                joined.push(joined.pop().slice(0, -1) + line)
            } else {
                joined.push(line)
            }
        }
        // right trim again because joining line continuations could lead to
        // blank lines with spaces e.g. ['   \', ''] joins to ['   ']
        lines = joined.map((l) => l.trimRight())

        // initialize individual parsers e.g. footnotes
        for (let block of blockparsers) {
            block?.init?.()
        }
        for (let inline of inlineparsers) {
            inline?.init?.()
        }

        // string preprocessing
        for (let process of preprocessors) {
            process(lines)
        }

        // Run the actual parse.
        let ast = parse_blocks(lines)

        // Do any post-processing
        for (let inline of inlineparsers) {
            inline?.postprocess?.(ast, parse_inline)
        }
        for (let block of blockparsers) {
            block?.postprocess?.(ast, {
                parse_blocks,
                parse_inline,
            })
        }

        // if there's a printer supplied, run the ast through it,
        // otherwise return the ast
        let html = (printer || html_printer)(ast)
        if (Object.keys(config).length == 0 || typeof html != 'string') {
            return html
        } else {
            config.body = html
            return config
        }
    }

    // predicate which detects blank lines
    function blankline(line) {
        return line == '' // remember, lines have been right trimmed
    }
    // predicate which detects indented lines
    function indented(line) {
        return line?.startsWith?.(' ')
    }

    // grab all lines satisfying predicate and return them
    function grablines(lines, predicate) {
        let grabbed = []
        while (lines.length > 0 && predicate(lines[0])) {
            grabbed.push(lines.shift())
        }
        return grabbed
    }

    /* ## `parse_blocks`
     * Run block level parsers on an array of strings (lines).
     * The block parsers call inline parsers themselves.
     *
     * Parameter:
     *    lines: an array of strings. These are right-trimmed
     *
     * Returns:
     *    an array of nodes found by the block parsers.
     *
     * Notes:
     *    Block parsers must have a `parse` function which takes
     *    * `lines`: the array of lines
     *    * {parse_blocks, parse_inline}: the parsers for recursive use
     *
     *    The block parser consumes lines and returns the parsed node if it succeeds,
     *    and leaves the lines array alone if it fails.
     */
    function parse_blocks(lines) {
        // text accummulates the text lines that aren't recognized by any
        // block parser.
        // ast is the output syntax tree.
        let text = [],
            ast = []

        while (lines.length > 0) {
            let node
            for (let bp of blockparsers) {
                // try each block parser on the current lines.
                if (
                    (node = bp.parse(lines, {
                        parse_blocks,
                        parse_inline,
                    }))
                ) {
                    // success - break out of the loop
                    break
                }
            }
            // node exists if the parse succeeded
            if (node) {
                if (node.name != 'omit') {
                    // push any existing text onto the ast as a textblock
                    // since it doesn't end with a blank line
                    push_text('textblock')
                    // then push the node on the ast list
                    ast.push(node)
                }
            } else {
                // the parse failed, so the line is
                // treated as text.
                if (blankline(lines[0])) {
                    //  blank creates a paragraph if we already have text
                    if (text.length > 0) {
                        text.push(lines.shift())
                        push_text('p')
                    } else {
                        // otherwise, we just push the blank onto the ast as a
                        // lonely text node.
                        ast.push({ name: 'text', text: lines.shift() })
                    }
                } else {
                    // if the line isn't blank, we add it to the lines of text
                    text.push(lines.shift())
                }
            }
        }

        // any remaining text lines are pushed onto the ast
        // These don't end with a blank so they aren't a paragraph
        text.length > 0 && push_text('textblock')

        return ast

        // push_text takes the existing array of text lines,
        // runs the inline parser, and pushes the result onto the
        // ast.
        function push_text(name) {
            // paragraphs are caused by a blank but we don't want
            // the blank in the paragraph, so we put it back on the input
            if (name == 'p') {
                lines.unshift(text.pop())
            }
            // no text means we've got nothing to do
            if (text.length == 0) {
                return
            }
            // run the inline parser over the lines as a single string.
            let children = parse_inline(text.join('\n'))
            if (name == 'p') {
                ast.push({ name, children })
            } else {
                // textblocks aren't a node, so their children
                // get pushed onto the ast directly
                ast.push(...children)
            }
            text = []
        }
    }

    // escapeRegex will escape chars in a string to let it be turned into a regex
    let escapeRegex = (string) => string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&'),
        // make_re takes a string and turns it into a regex with negative lookbehind for \ escapes
        make_re = (txt) => new RegExp('(?<!\\\\)' + escapeRegex(txt), 'g'),
        // noesc removes escape slashes from a string
        noesc = (txt) => txt.replaceAll(/\\(?!\\)/g, '')

    /** ## `parse_inline`
     * Runs the inline parsers
     *
     * Parameters:
     *    text: a string of text to parse.
     *    endsWith: a string to terminate the parse.
     *
     * Returns:
     *    an array of nodes. Inlined nodes have type:'inline', which may make
     *    printing them nicer.
     *
     * Notes:
     *    The inline parsers must have a `parse` function which takes
     *    * {text, cursor}: change the cursor
     *    * {parse_inline}: the parsers for recursive use
     *
     *    The inline parser consumes text and returns the parsed node if it succeeds,
     *    and leaves the text unchanged if it fails.
     *
     */
    function parse_inline(state, endsWith) {
        if (typeof state == 'string') {
            state = { text: state, cursor: 0 }
        }
        if (typeof endsWith == 'string') {
            // turn it into a regex which lookbehinds for \
            // if endsWith is a regex it **must** do this itself.
            endsWith = make_re(endsWith)
        }
        let ast = [],
            node,
            ender = {}
        // ender is a parser like object
        if (!endsWith) {
            // matches end of string
            ender.indexOf = (str) => str.length
        } else {
            // matches whatever char set endsWith was, but
            // if not found it matches end of string.
            // different behaviour from other indexOf which return -1
            // if they fail a match
            ender.indexOf = (str, start) => {
                endsWith.lastIndex = start
                let match = endsWith.exec(str)
                if (match) {
                    return match.index
                } else {
                    return str.length
                }
            }
        }

        // copy the inline parsers because we will be
        // removing those that fail to match.
        let currentparsers = [...inlineparsers]

        while (state.cursor < state.text.length) {
            // match endsWith to text starting at cursor
            // this needs to be done every loop because some other parser could
            // eat the endsWith characters.
            let idx = ender.indexOf(state.text, state.cursor),
                first = ender
            // match all parsers & keep the one that matches closest
            for (let i = 0; i < currentparsers.length; i++) {
                let parser = currentparsers[i],
                    idxp = parser.indexOf(state.text, state.cursor)
                if (idxp != -1 && idxp < idx) {
                    idx = idxp
                    first = parser
                }
                // if the parse didn't match, it never will, so mark for
                // removal. This makes subsequent parser loops much faster.
                if (idxp == -1) {
                    currentparsers[i] = undefined
                }
            }
            // remove the parsers that don't match
            currentparsers = currentparsers.filter((c) => c)

            // if there is a gap between the cursor and the match, it is text
            if (idx > state.cursor) {
                ast.push({
                    name: 'text',
                    text: noesc(state.text.slice(state.cursor, idx)),
                })
                state.cursor = idx
            }

            if (first == ender) {
                // we've finished
                break
            } else {
                // try the parser
                if ((node = first.parse(state, parse_inline))) {
                    ast.push(node)
                } else {
                    // push a single char onto the ast & advance 1
                    ast.push({
                        name: 'text',
                        text: noesc(state.text.at(state.cursor++)),
                    })
                }
            }
        }
        // add an inline flag to each node to help the printer
        ast.forEach((node) => {
            node.type = 'inline'
        })
        return ast
    }

    /* ## Block Parsers.
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
     * The latter two parameters are used when block parsers need to invoke parsing to finish. For example,
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
     */

    /* ### Headers
     *
     * A header starts with 1 to 6 `#` characters followed by a space, then the header text. If the text goes over
     * more than one line, use a line continuation (a backslash). The header text is passed to the `inline_parse`
     * function. Only atx-style headers are supported, because I don't like Setext headers.
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

    /* ### Block Quote
     *
     * A block quote is a set of lines starting with '>' and (optionally) one space.
     * The lines of text following the '>' are dedented up to 1 space and then passed to `parse_blocks`
     * so blockquote can contain any block level element.
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

    /* ### Indented Codeblock
     *
     * A series of lines starting with *at least* four spaces is a code block.
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
     * Currently, there are three fence types:
     * * `omit`: all text between the fences is left out of the document
     * * `verbatim`: all text between the fences is passed through unchanged.
     * * `config`: define simple config data on the global config object
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

    let fencehandler = {}

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
     * following lines in a list item (if any) or 2.
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
     * following lines in a list item (if any) or 2.
     */
    blockparsers.add({
        name: 'ordered_list',
        re: /^([0-9]+|[a-zA-Z]|[mclxivMCLXIV]+)[).] /, // tricky - multiple numbers, or onew letter, or multiple roman
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

    // finds the lines that correspond to a list item
    // begining with the regex. Returns the item prefix and
    // the number of lines in the item.
    function list_item(lines, regex, check) {
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

    // dedent list items
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

    /** ### Horizontal Rule
     *
     * Any line starting with `---`, `***`, or `___` is a horizontal rule.
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
     * definition. A footnote definition is a line beginning with `[^label]:` followed by
     * any number of indented or blank lines. The text is passed to the `parse_blocks` routine so any
     * block-level elements can be in a footnote.
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
     * A href definition is a line beginning [number]: It has an address and an optional title.
     * It is referred to by a link element.
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
     * A table is a series of rows. A row is is a line which starts with a | character, and is followed
     * by a series of cell-text then | i.e. "|cell1|cell2|cell3|". cell text can be any inline element.
     *
     * If the cells in the **second** row of the table are :---, ---:, :---:, or ---, this
     * makes the first row a table header and determines the alignment of the cells in each column.
     * If the second row is not like this, there is no header and everything is left-justified.
     *
     */
    blockparsers.add({
        name: 'table',
        parse(lines, { parse_inline }) {
            let rows = [],
                row,
                rowcount = 0,
                alignment,
                alignedrow = -1
            while ((row = this.row(lines[0], parse_inline, rowcount + 1))) {
                rowcount++
                lines.shift()
                if (!row.name) {
                    alignment = row
                    alignedrow = rowcount
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
                // first row is header if alignment in row 2
                if (alignedrow == 2) {
                    for (let c of rows[0].children) {
                        c.name = 'th'
                    }
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
                if (number <= 2 && cols.every((c) => c && c.match(/^ *:?-+:? *$/))) {
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

    /* ## Inline Parsing.
     *
     * inline elements are parsed from strings using inline parsers. An inline parser
     * is an object with the following properties:
     *
     * ### `name`
     * A string. The name of the parser, and often the name of the node it creates.
     *
     * ### `indexOf`
     * A function which takes a string and starts pair and returns the first index at which
     * the parser could run, after cursor. Basically the same as string.indexOf. Return -1 if
     * not found.
     *
     * ### `parse`
     * A function which takes a {text, cursor} pair and the inline parser. It should parse
     * the text (starting at text[cursor]) for the inline element. We can guarantee that
     * the find function of the parser will return cursor, because that's when the parser is called.
     *
     * If it succeeds, it should modify the cursor property of the text-object to indicate
     * how many characters it has consumed and return the parsed node. If it fails, it
     * should return false.
     *
     *  ### `init` (optional)
     * Called before parsing to do setup as needed. Most parsers don't have this.
     *
     * ### `postprocess` (optional)
     * Called after parsing to perform any followup actions. This function takes the
     * parsed syntax tree (array of nodes, as it happens) and returns a (possibly altered)
     * syntax tree.
     *
     * There are two helper functions for making delimited or capture parsers.
     */

    function make_indexOf(str) {
        let re = make_re(str)
        return function (text, start) {
            re.lastIndex = start
            let match = re.exec(text)
            return match ? match.index : -1
        }
    }

    /* delimited makes a parser where the span is delimited by start & end strings,
     *  and the interior must be parsed.
     */
    function delimited(name, startsWith, endsWith, process = (x) => x) {
        let re_endsWith = make_re(endsWith)
        return {
            name,
            indexOf: make_indexOf(startsWith),
            parse(state, parse_inline) {
                state.cursor += startsWith.length
                let children = parse_inline(state, re_endsWith)
                state.cursor += endsWith.length
                return process({
                    name,
                    children,
                })
            },
        }
    }

    /* grab returns a string from text
     * text - text object
     * start - where to start looking from
     * target - a regular expression matching the end
     * end_ok - if target considered found when string ends
     *
     * advances text past the target and returns the stretch
     * of it from start to target.
     */
    function grab(state, target, start = 0, end_ok = true) {
        target.lastIndex = state.cursor + start
        let idx = target.exec(state.text)?.index
        if (idx >= 0) {
            txt = state.text.slice(start + state.cursor, idx)
            state.cursor = idx
            return txt
        } else {
            if (end_ok) {
                let txt = state.text.slice(start + state.cursor)
                state.cursor = state.text.length
                return txt
            } else {
                return -1
            }
        }
    }

    /* capture makes a parser where the span is delimited but the interior must not be parsed. */
    function capture(name, startsWith, endsWith, process = (x) => x, textfilter = noesc) {
        let re_endsWith = make_re(endsWith)
        return {
            name,
            indexOf: make_indexOf(startsWith),
            parse(state) {
                state.cursor += startsWith.length
                // we consider unmatched start/end to go to the
                // end of input.
                let txt = grab(state, re_endsWith, 0)
                state.cursor += endsWith.length
                return process({
                    name,
                    children: [{ name: 'text', text: textfilter(txt) }],
                })
            },
        }
    }

    // longer startsWith must be added before shorter prefixes, or
    // there will be trouble.
    inlineparsers.add(delimited('strong', '**', '**'))
    inlineparsers.add(delimited('em', '*', '*'))
    inlineparsers.add(delimited('strong', '__', '__'))
    inlineparsers.add(delimited('em', '_', '_'))
    inlineparsers.add(delimited('sup', '^', '^'))
    inlineparsers.add(delimited('sub', '~', '~'))
    // obviously it's a trivial matter to add more parsers !
    inlineparsers.add(capture('code', '`', '`'))

    /* footnote citation is [^label]
     */
    inlineparsers.add(
        capture('footnote_cite', '[^', ']', ({ name, children }) => {
            let fn = blockparsers.byname['footnote_def'],
                item = {
                    name: 'sup',
                    children: [
                        {
                            name: 'a',
                            key: noesc(children[0].text), // this gets turned into an href attribute later.
                            attributes: {},
                            children,
                        },
                    ],
                }
            fn.cites.push(item.children[0])
            return item
        })
    )

    /** markdown links
     *
     * a) [link text](link "title") => <a href="link" title="title">link text</a>
     * b) [link text](id) & [id]: link "optional text" => does the same
     * c) [](id) is short for [id](id)
     * d) [](link) is short for [link](link), except that link is *not* parsed within [...]
     *
     * <a> attributes:
     *   - download (to download a file)
     *   - target (_self or _blank)
     *   - title displays a tooltip
     */

    let _bracket = make_re(')'),
        _start_href = make_re('](')

    inlineparsers.add({
        name: 'a',
        indexOf: make_indexOf('['),
        parse(state, parse_inline) {
            let cursor = state.cursor
            state.cursor++ // skip over the [
            // the <a> tag can go around more html.
            let children = parse_inline(state, _start_href)
            if (state.cursor == state.length) {
                // failed, there is no ](
                state.cursor = cursor
                return false
            }
            let href = grab(state, _bracket, 2, false)
            if (href == -1) {
                // failed
                state.cursor = cursor
                return false
            }
            state.cursor++
            href = noesc(href)
            let node = {
                name: 'a',
                children,
                attributes: { href },
            }
            if (node.children.length == 0) {
                // the link text should be the same as the href.
                // This update is done in post for reference style links
                node.children.push({ name: 'text', text: href })
            }
            blockparsers.byname['href_def'].links.push(node)
            return node
        },
    })

    /* images
     *
     * a) ![alt text](link "title") => <a href="link" title="title">link text</a>
     * b) ![alt text](id) & [id]: link "optional text" => does the same
     * c) ![](id) is short for [id](id)
     * d) ![](link) is short for [link](link), except that link is *not* parsed within [...]
     */
    inlineparsers.add({
        name: 'img',
        indexOf: make_indexOf('!['),
        parse(state) {
            let cursor = state.cursor
            state.cursor += 2 // skip over the ![
            alt = grab(state, _start_href, 0, false)
            if (alt == -1) {
                state.cursor = cursor
                return false
            }
            let src = grab(state, _bracket, 2, false)
            if (src == -1) {
                // failed
                state.cursor = cursor
                return false
            }
            state.cursor++
            src = noesc(src)
            alt = noesc(alt)
            let node = {
                name: 'img',
                attributes: { src, alt },
            }
            // we share href definitions with links
            blockparsers.byname['href_def'].links.push(node)
            return node
        },
    })

    /* HTML printing */

    // create a string that contains the attributes in an object
    function attributes(attr) {
        if (!attr) {
            return ''
        }
        let attrs = []
        for (let name in attr) {
            attrs.push(`${name}="${attr[name]}"`)
        }
        return ' ' + attrs.join(' ')
    }

    function html_escape(s) {
        let entity = {
            '>': '&gt;',
            '&': '&amp;',
            '<': '&lt;',
        }
        return s.replaceAll(/<|&|>/g, (c) => entity[c])
    }

    // printers holds all the tag printers that are called.
    let printers = {}

    function html_printer(ast, indent = '') {
        // block level printer, calls inlined when needed.
        // It's guaranteed that the returned string is indented properly
        // and has all the right line breaks, including one at the end.
        if (Array.isArray(ast)) {
            let outstr = ''
            for (let node of ast) {
                // this is where the line breaks come in
                outstr += html_printer(node, indent)
            }
            return outstr
        } else {
            if (ast.type == 'inline') {
                return inlined(ast, indent) + '\n'
            }
            if (printers[ast.name]) {
                // the tag requires some custom printing
                return printers[ast.name](ast, indent)
            }
            // otherwise, we do a standard print
            if (ast.children) {
                return [
                    indent + `<${ast.name}${attributes(ast.attributes)}>\n`,
                    html_printer(ast.children, indent + '    '),
                    indent + `</${ast.name}>\n`,
                ].join('')
            } else {
                return [
                    indent + `<${ast.name}${attributes(ast.attributes)}>\n`,
                    indent + `</${ast.name}>\n`,
                ].join('')
            }
        }
    }

    printers.text = function (ast, indent) {
        let text = ast.text
            .split('\n')
            .map((t) => indent + t)
            .join('\n')
        if (!text.endsWith('\n') && ast.type != 'inline') {
            text += '\n'
        }
        return text
    }

    printers.h1 =
        printers.h2 =
        printers.h3 =
        printers.h4 =
        printers.h5 =
        printers.h6 =
        printers.p =
            function (ast, indent) {
                return [
                    indent + `<${ast.name}${attributes(ast.attributes)}>\n`,
                    inlined(ast.children, indent + '    ') + '\n',
                    indent + `</${ast.name}>\n`,
                ].join('')
            }

    printers.codeblock = function (ast, indent) {
        return [
            indent + `<pre> <code${attributes(ast.attributes)}>\n`,
            ast.children.map((c) => html_escape(c.text)).join('\n') + '\n',
            indent + '</code> </pre>\n',
        ].join('')
    }

    printers.hr = function (ast, indent) {
        return indent + '<hr>\n'
    }

    printers.verbatim = function (ast, indent) {
        return ast.children.join('\n') + '\n'
    }

    printers.omit = () => ''

    function inlined(ast, indent = '') {
        // inlined does not put a \n at the end.
        if (Array.isArray(ast)) {
            let outstr = ''
            for (let node of ast) {
                outstr += inlined(node)
            }
            if (indent != '') {
                outstr = outstr
                    .split('\n')
                    .map((line) => indent + line)
                    .join('\n')
            }
            return outstr
        } else {
            if (printers[ast.name]) {
                // the tag requires some custom printing
                return printers[ast.name](ast, indent)
            }
            // otherwise
            return (
                indent + // indent is almost always ''
                `<${ast.name}${attributes(ast.attributes)}>` +
                inlined(ast.children) +
                `</${ast.name}>`
            )
        }
    }

    printers.img = function (ast, indent) {
        return `<${ast.name}${attributes(ast.attributes)}>`
    }

    printers.code = function (ast, indent) {
        return (
            indent + // indent is almost always ''
            `<code${attributes(ast.attributes)}>` +
            ast.children.map((c) => html_escape(c.text)).join('') +
            `</code>`
        )
    }

    // now return all the parts
    return {
        scratchmark,
        config,
        preprocessors,
        blockparsers,
        inlineparsers,
        grablines,
        blankline,
        indented,
        delimited,
        capture,
        dedent,
        html_printer,
        printers,
    }
})()
