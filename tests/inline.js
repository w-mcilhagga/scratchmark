let tests = [
    'This line has no\nparticular markup',
    'This line uses **bold** and *emphasis*',
    'This line uses __bold__ and _emphasis_',
    'This line **nests *emphasis*** within bold',
    'This line \\*escapes emphasis*',
    'A comparison `y<=5*10` with text after it.',
    'There is some formula $\\alpha = {1\\over 2}$ here',
    //'There is some $inline _maths_ with \\$ escaped dollars $',
    'Inlined display $$\\alpha = {1\\over 2} $$ and some more text',
    'You might want to <em class=abc>emphasize</em> something using regular HTML',
    '[a **link**](http://whatev)',
    '[a bad link(http://whatev)',
    '![alt text here](red.png)',
    'a link on an img: [![alt text here](red.png)](http://whereev)',
    ` a reference link: [link here](goog) and [](goog)
[goog]: http://google.com
    `,
    ` a reference link on an image: ![alt text](redimg) 
[redimg]: tests/red.png
    `,
    ` An anon link: [](http://a.b.com)`,
]
