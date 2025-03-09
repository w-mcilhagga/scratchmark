// an extension to include latex maths as block or inline

;(function (md) {
    let { blockparsers, inlineparsers, capture, grablines, printers } = md
    blockparsers.add({
        name: 'displaymaths',
        parse(lines) {
            if (lines[0].startsWith('$$')) {
                let children
                if (lines[0].endsWith('$$') && lines[0].length >= 4) {
                    // this is a one-line display maths
                    children = [{ name: 'text', text: lines.shift() }]
                } else {
                    // this is over multiple lines
                    children = [
                        lines.shift(), // the line starting $$
                        ...grablines(lines, (line) => !line.endsWith('$$')), // inside lines if any
                        lines.shift(), // the line ending $$
                    ].map((c) => ({ name: 'text', text: c }))
                }
                // get rid of the $$ at start
                children[0].text = children[0].text.slice(2)
                if (children[0].text.length == 0) {
                    children.shift()
                }
                // get rid of the $$ at end
                children.at(-1).text = children.at(-1).text.slice(0, -2)
                if (children.at(-1).text.length == 0) {
                    children.pop()
                }
                return {
                    name: 'displaymaths',
                    children: children,
                }
            }
        },
    })

    // displaymaths can also be inline so that we can include it in table cells
    inlineparsers.add(
        capture(
            'displaymaths',
            '$$',
            '$$',
            (x) => x,
            (x) => x // don't remove backslashes
        )
    )
    inlineparsers.add(
        capture(
            'inlinemaths',
            '$',
            '$',
            (x) => x,
            (x) => x // don't remove backslashes
        )
    )

    // if katex isn't available, the printers write the
    // maths out for autorender.

    let macros = {}
    printers.displaymaths = function (ast, indent) {
        let txt = ast.children.map((t) => t.text).join('\n')
        try {
            return katex.renderToString(txt, {
                throwOnError: false,
                displayMode: true,
                globalGroup: true,
                macros,
            })
        } catch (e) {
            return '$$' + txt + '\n$$\n'
        }
    }

    printers.inlinemaths = function (ast, indent) {
        try {
            return katex.renderToString(ast.children[0].text, {
                throwOnError: false,
                displayMode: false,
                globalGroup: true,
                macros,
            })
        } catch (e) {
            return '$' + ast.children[0].text + '$'
        }
    }
})(md)
