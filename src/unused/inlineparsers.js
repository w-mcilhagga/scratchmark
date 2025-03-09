/** ## Inline Parsing.
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

/** delimited makes a parser where the span is delimited by start & end strings,
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

function grab(state, target, start = 0, end_ok = true) {
    // returns a string from text
    // text - text object
    // start - where to start looking from
    // target - a regular expression matching the end
    // end_ok - if target considered found when string ends
    //
    // advances text past the target and returns the stretch
    // of it from start to target.
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

/** capture makes a parser where the span is delimited but the interior must not be parsed. */
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
// obviously it's a trivial matter to add more !
inlineparsers.add(capture('code', '`', '`'))

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
