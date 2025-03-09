// attribute elements are inline or block and of the form
// {.class}, {#id}, or {: name=value name=value ... }
//
// attributes are attached to the previous sibling or to the parent, if no previous sibling.

;(function (md) {
    let { inlineparsers, delimited, capture } = md

    let attr_re = /[A-Za-z0-9-]+ *= *([A-Za-z0-9-]+|'[^']+'|"[^"]+")/g

    let attrcount = 0
    function parse_attributes(str) {
        let nv = str.match(attr_re).map((pair) => pair.split(/ *= */)),
            attributes = {}

        for (let i = 0; i < nv.length; i++) {
            let name = nv[i][0],
                value = nv[i][1]
            // remove leading & trailing quotes if any
            value = value.replace(/^ *["']/, '').replace(/["'] *$/, '')
            attributes[name] = value
        }
        return { name: 'attributes', attributes }
    }

    blockparsers.add({
        name: 'attributes',
        parse(lines) {
            if (lines[0].match(/^{[:#\.][^}]*}$/)) {
                // a single line attribute
                let node
                switch (lines[0].slice(0, 2)) {
                    case '{.':
                        // class definition
                        node = {
                            name: 'attribute',
                            attributes: { class: lines[0].slice(2, -1) },
                        }
                        break
                    case '{#':
                        // id definition
                        node = {
                            name: 'attribute',
                            attributes: { id: lines[0].slice(2, -1) },
                        }
                        break
                    case '{:':
                        node = parse_attributes(lines[0].slice(2, -1))
                        break
                }
                lines.shift()
                attrcount++
                return node
            }
        },
        init() {
            attrcount = 0
        },
        postprocess(ast) {
            if (attrcount > 0) {
                trace(ast)
            }
            return ast

            function trace(ast, parent, previous_sibling) {
                if (Array.isArray(ast)) {
                    for (let node of ast) {
                        trace(node, parent, previous_sibling)
                        if (!node.name.startsWith('text') && node.name != 'omit') {
                            previous_sibling = node
                        }
                    }
                } else {
                    if (ast.name == 'attributes') {
                        copy_attributes(ast.attributes, previous_sibling || parent)
                        ast.name = 'omit'
                    } else if (ast.children) {
                        trace(ast.children, ast)
                    }
                }
            }

            function copy_attributes(attributes, target) {
                let join = (a, b) => (a ? a + ';' + b : b)
                if (target) {
                    target.attributes ||= {}
                    for (let name in attributes) {
                        if (name == 'style') {
                            target.attributes.style = join(
                                target.attributes.style,
                                attributes.style
                            )
                        } else {
                            target.attributes[name] = attributes[name]
                        }
                    }
                }
            }
        },
    })

    // we have 3 different variants for inline attributes.
    // because startsWith must be a string.

    inlineparsers.add(
        capture('attributes', '{.', '}', (node) => {
            node.attributes = { class: node.children[0].text }
            delete node.children
            attrcount++
            return node
        })
    )

    inlineparsers.add(
        capture('attributes', '{#', '}', (node) => {
            node.attributes = { id: node.children[0].text }
            delete node.children
            attrcount++
            return node
        })
    )

    inlineparsers.add(
        capture('attributes', '{:', '}', (node) => {
            attrcount++
            return parse_attributes(node.children[0].text)
        })
    )
})(md)
