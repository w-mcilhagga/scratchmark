// a default template.

function plain(config) {
    return `<!doctype html>
<html>
<head>
<title>${config.title}</title>
<link rel="stylesheet" href="styles/github-markdown.css" />
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css"
    crossorigin="anonymous"
/>
<style>
    .markdown-body,
    #buttons {
        box-sizing: border-box;
        min-width: 200px;
        max-width: 980px;
        margin: 0 auto;
        padding: 45px;
    }

    @media (max-width: 767px) {
        .markdown-body {
            padding: 15px;
        }
    }
</style>
</head>
<body>
<div class="markdown-body">
${config.body}
</div>
</body>
</html>
`
}
