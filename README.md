# scratchmark
a markdown implementation in javascript.

## Usage.

Including the `scratchmark.js` or `scratchmark.min.js` file creates a global object `md` which contains the various scratchmark components.

```html
<script src='path/to/scratchmark.js'></script>
<script>
let html_string = md.scratchmark(markdown_string)
</script>
```

There is an online demo at ... 

The scratchmark function has two parameters:
* `lines`: a string containing markdown.
* `printer`: (optional) a function which takes a markdown syntax tree
   and converts it to some desired output string. If not supplied, it defaults
   to `md.html_printer`. If you want to see the markdown syntax tree,
   pass `(tree) => tree` as the printer argument.

## Extensions.
scratchmark comes supplied with a few extensions. These can be activated by including them in script tags.

* **attributes**: include the file `attr_extension.js`
* **maths**: include the file `math_extension.js`. This uses katex, so you will need
  to include their css file in the final html page.
* **sections**: include the file `section_extension.js`.