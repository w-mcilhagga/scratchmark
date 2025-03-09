tests = [
    `## Basic.

| Header 1  | Header 2  |
| --------- | --------- |
| Cell 1    | Cell 2    |
| Cell 3    | Cell 4    |
`,
    `## Without headers.

| not Header 1  | not Header 2  |
| Cell 1    | Cell 2    |
| Cell 3    | Cell 4    |
`,
    `## Single column.

| Header  |
| ------- |
| Cell    |
`,
    `
## Table alignment:

| Default   | Right     |  Center   |     Left  |
|-----------|:----------|:---------:|----------:|
| Long Cell | **Long Bold Cell** | Long Cell | Long Cell |
| Cell      | Cell      |   Cell    |     Cell  |
`,

    `
## Table alignment 2:

| Default   | Right     |  Center   |     Left  |
| --------- | :-------- | :-------: | --------: |
| Long Cell | Long Cell | Long Cell | Long Cell |
| Cell      | Cell      |   Cell    |     Cell  |
`,

    `
## Too many pipes in rows

| Header 1  | Header 2  |
| --------- |
| Cell      | Cell      | Extra cell? |
| Cell      | Cell      | Extra cell? |
`,
]
