;(function (md) {
    function labels(lines) {
        // {a.b=} defines a counter a.b & gives b a value, e.g. [[figure.circle=]]
        // defines a counter circle within figure and starts the figure count if not defined.
        // {=a.b} retrieves the counter value
        let counters = {},
            ids = {}
        // first pass gets all the label definitions
        for (let i = 0; i < lines.length; i++) {
            let str = lines[i]
            str = str.replace(/{[A-Za-z.]+=}/g, function (m) {
                let [domain, id] = m.slice(1, -2).split('.')
                if (!ids[domain + '.' + id]) {
                    counters[domain] = (counters[domain] || 0) + 1
                    ids[domain + '.' + id] = counters[domain]
                }
                return ids[domain + '.' + id]
            })
            lines[i] = str
        }
        // second pass replaces all the references
        for (let i = 0; i < lines.length; i++) {
            let str = lines[i]
            str = str.replace(/{=[A-Za-z.]+}/g, function (m) {
                let id = m.slice(2, -1)
                return ids[id] || m
            })
            lines[i] = str
        }
    }

    md.preprocessors.push(labels)
})()
