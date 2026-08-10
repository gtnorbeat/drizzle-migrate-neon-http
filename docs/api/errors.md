# Error codes

```js
import { isAlreadyExists, ALREADY_EXISTS_CODES } from "drizzle-migrate-neon-http/errors";
```

## `isAlreadyExists(code)`

Returns `true` when a PostgreSQL error `code` is one of the known
"object already exists" conditions that are safe to skip during migration.

Used internally by the runner's [`executeStatement`](/api/runMigrations) so that
re-running against a partially-applied schema **heals** rather than explodes.

```js
isAlreadyExists("42P07"); // true
isAlreadyExists("23505"); // false — unique violation is NOT skipped
```

## `ALREADY_EXISTS_CODES`

The exact set:

| Code | Meaning |
|---|---|
| `42P07` | relation already exists |
| `42701` | column already exists |
| `42710` | object already exists |
| `42P16` | cannot change number of columns |
| `42723` | function already exists |
| `42P17` | index already exists |

## Design note

These codes represent *desired end states* — re-creating an object that's already
there. They're intentionally narrow: transient errors, constraint violations
(`23505`) and everything else are **re-thrown** so real problems surface loudly
instead of being silently swallowed.