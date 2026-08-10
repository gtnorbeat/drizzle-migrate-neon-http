# splitStatements()

```js
import { splitStatements } from "drizzle-migrate-neon-http/split-statements";
```

Splits raw migration SQL text into individual executable statements, robust to
the things that normally break regex-based splitters.

## Signature

```ts
splitStatements(text: string): string[]
```

## Rules

- Splits on `;` **outside** single-quoted string literals.
- A backslash escapes a quote (handles `'it''s'`-style and `\'` escapes).
- Strips `--` line comments *before* splitting, so a comment can never swallow
  a following statement.
- Drops empty / whitespace-only chunks.
- Returns trimmed statements preserving file order.

## Examples

```js
splitStatements("CREATE TABLE a (id int); CREATE TABLE b (id int);");
// ['CREATE TABLE a (id int)', 'CREATE TABLE b (id int)']

splitStatements("INSERT INTO t (v) VALUES ('hello; world'); SELECT 1;");
// ['INSERT INTO t (v) VALUES (\'hello; world\')', 'SELECT 1']

splitStatements("-- comment\n;SELECT 1; -- trailing");
// ['SELECT 1']
```

## Why not a regex?

Semicolons inside string literals (data, comments, `$$` blocks) break naive
`split(';')`. This implementation scans char-by-char, tracking string state, so
it survives realistic Drizzle-generated SQL (constraints, check clauses, defaults
with literal semicolons in strings).