let tests = [
    `
Indented by 4 spaces causes a code block:
    This is code
    This is too
        as is this
   This isn't

`,
    `
Fenced code is easier
\`\`\`javascript
let x=5
return y
   // comment
\`\`\`
`,
    `
HTML
\`\`\`javascript
<strong>xxxx</strong>
\`\`\`
`,
]
