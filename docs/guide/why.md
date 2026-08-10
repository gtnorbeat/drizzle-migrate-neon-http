# Why this exists

Neon is serverless Postgres. That's great — until you try to run schema migrations
against it with the official driver.

## The problem

[`@neondatabase/serverless`](https://github.com/neondatabase/serverless) ships a query
function that **only works as a tagged template**:

```js
import { neon } from "@neondatabase/serverless";
const sql = neon(DATABASE_URL);

// ✅ tagged template works
await sql`SELECT 1`;

// ❌ raw string throws
await sql("CREATE TABLE users (id serial primary key)");
// TypeError: "The query function does not support string arguments"
```

A real Drizzle migration file is a string of SQL with **dozens of statements**:

```sql
CREATE TABLE IF NOT EXISTS "users" (...);
ALTER TABLE "users" ADD CONSTRAINT ...;
CREATE INDEX IF NOT EXISTS ...;
```

Existing migration runners hand that whole string to the driver. On Neon HTTP
that explodes with the `TypeError` above. The usual workarounds are worse than
the disease: stand up a local Postgres just to run migrations, or run a TCP
tunnel to Neon. Both defeat the purpose of serverless.

## What this package does instead

1. **Splits** your migration file into individual statements (string-literal-aware,
   comment-safe — see [splitStatements](/api/splitStatements)).
2. **Executes** each statement via `sql.query(stmt)` — the explicit, raw-string
   variant of the Neon driver.
3. **Tracks** applied migrations by SHA-256 in `drizzle.__drizzle_migrations`,
   mirroring Drizzle's own journal model.
4. **Recovers** from partially-applied states by skipping idempotent
   "object already exists" errors (`42P07`, `42701`, `42710`, `42P16`, `42723`,
   `42P17`) — see [error codes](/api/errors).

## Why you should care

- **No local Postgres.** Migrations run against the same Neon endpoint you deploy.
- **No emulation layer.** Raw SQL, real driver, real serverless HTTP.
- **CI-friendly.** A single `DATABASE_URL` and a binary; works in any pipeline.
- **Small and owned.** It knows only migrations, SQL and Neon. No business logic,
  no framework coupling. A good citizen for any serverless Postgres project.