let tests = [
    `
## Tight list:
1. one
1. two
1. three
 and continue on another line.
***
`,
    `
## Tight list with trailing blanks:
1. one
10. two
2. three



and stop.
`,
    `
## Loose list:
a) one

  and a ...
b) two
c) three
and stop.
`,
    `
## Loose list:
a) # Heading should make the list loose.
b) two
z) three
and stop.
`,
    `
## Loose list:
i) one

 and another line
ii) two
mcmlxvii) three
and stop.
`,
    `
## Changing markers
1. one
2. two
3) three
4) four
a) five
b) six

Should produce 3 lists.`,
]
