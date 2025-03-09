let tests = [
    `
<div style='text-align:right'>
This is over to the <strong>right</strong>
</div>
`,
    `
<!-- this shouldn't appear -->
This should
`,
    `
<script>
// this is inserted in the dom but doesn't execute - thats ok for my uses
alert('it worked')
</script>
`,
]
