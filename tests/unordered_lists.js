let tests = [
    `
## Tight list:
* one
* two
* three
 and continue on another line.
***
`,
    `
## Tight list with trailing blanks:
* one
* two
* three



and stop.
`,
    `
## Loose list:
* one

  and a ...
* two
* three
and stop.
`,
    `
## Loose list:
* # Heading should make the list loose.
* two
* three
and stop.
`,
    `
## Loose list:
* one

 and another line
* two
* three
and stop.
`,
    `
## Changing markers
* one
* two
+ three
+ four
- five
- six

Should produce 3 lists.`,
]
