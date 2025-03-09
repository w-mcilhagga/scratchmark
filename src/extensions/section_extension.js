// sections are a title + : followed by an indented text.
// The indented text is run through scratchmark, and them passed to
// the section handler.

/** a section start is a series of letters or spaces followed by a colon.
 * If there is text after it, that's not a problem.
 */

// a global variable called md exists

;(function (md) {
    let { blockparsers, dedent, blankline, indented, grablines } = md

    blockparsers.add({
        name: 'section',
        parse(lines, { parse_blocks }) {
            let prefix
            if ((prefix = lines[0].match(/^[A-Za-z ]+: */)?.[0])) {
                // create an object like a list item to reuse the dedent function
                let item = { prefix }
                item.lines = [
                    lines.shift(),
                    ...grablines(lines, (line) => indented(line) || blankline(line)),
                ]
                dedent([item])
                if (item.lines[0].length == 0) {
                    // it was the title all by itself
                    item.lines.shift()
                }
                let node = {
                    name: prefix.trimRight().slice(0, -1),
                    children: parse_blocks(item.lines),
                }
                let handler = section_handler[node.name.toLowerCase()]
                if (handler) {
                    node = handler(node)
                }
                return node
            }
        },
    })

    let section_handler = {}

    section_handler.figure = function (node) {
        // the section is a figure. A blockquote is converted to a figcaption
        // and any p nodes are flattened.

        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i].name == 'blockquote') {
                node.children[i].name = 'figcaption'
            } else if (node.children[i].name == 'p') {
                node.children[i] = node.children[i].children
            }
        }
        node.children = node.children.flat()
        return node
    }
})(md)
