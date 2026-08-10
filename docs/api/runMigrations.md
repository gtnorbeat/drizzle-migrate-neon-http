# runMigrations()

```js
import { runMigrations } from "drizzle-migrate-neon-http";
```

Runs every pending migration from a Drizzle journal over a Neon HTTP connection.

## Signature

```ts
runMigrations(options: {
  sql: NeonQueryFunction;   // the return of neon(DATABASE_URL)
  migrationsDir: string;    // path to the drizzle `out` directory
  dryRun?: boolean;         // default false
  log?: { log(msg: string): void; error(msg: string): void }; // default console
  alreadyApplied?: Set<string>; // pre-seeded hashes (e.g. for tests/tools)
}): Promise<void>
```

## Behavior

1. Creates the `drizzle` schema and `drizzle.__drizzle_migrations` tracking table
   (`id`, `hash`, `created_at`) if missing.
2. Reads `{migrationsDir}/meta/_journal.json` for the ordered migration list.
3. For each file not yet applied (by SHA-256):
   - splits it with [splitStatements](/api/splitStatements)
   - executes each statement via `sql.query(stmt)`
   - records the file hash in the tracking table
4. Skips files already applied (hash match).

## Re-runs & healing

Migrations tracked by hash are skipped. If a file was partially applied during a
previous failed run, the `object already exists` codes are skipped so the rest
completes (see [error codes](/api/errors)). Fully-applied files are never
re-executed.

## Example

```js
import { neon } from "@neondatabase/serverless";
import { runMigrations } from "drizzle-migrate-neon-http";

const sql = neon(process.env.DATABASE_URL);

await runMigrations({
  sql,
  migrationsDir: "./drizzle",
  log: {
    log: (m) => console.log(m),
    error: (m) => console.error(m),
  },
});
```

## Errors

The function throws when:

- the journal file is missing or unreadable
- a referenced `.sql` file is missing
- a statement fails with a non-idempotent error (see [errors](/api/errors))

Failures abort the file, and the package exits the process with code `1` from the
CLI. The tracking table is only written **after** all statements in a file succeed.