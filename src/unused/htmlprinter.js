let { html_printer, printers } = (function (md) {
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
            '<': '&lt;',
            '&': '&amp;',
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

    return { html_printer, printers }
})(md)
