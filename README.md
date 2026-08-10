# drizzle-migrate-neon-http

> Run Drizzle SQL migrations on Neon's serverless HTTP driver — no multi-statement
> SQL, no local Postgres emulation, no night sweats.

[![npm version](https://img.shields.io/npm/v/drizzle-migrate-neon-http.svg?style=flat-square)](https://www.npmjs.com/package/drizzle-migrate-neon-http)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## Why does this exist?

[`@neondatabase/serverless`](https://github.com/neondatabase/serverless) **v1+ only works as a
tagged template.** You can write `sql\`SELECT 1\``, but you cannot hand it a raw SQL string
with multiple statements:

```js
await sql(`CREATE TABLE users (...); INSERT INTO users (...) ...`);
// 💥 TypeError: "The query function does not support string arguments"
```

That means stock migration runners (which feed the whole migration file to the driver) break
on Neon HTTP out of the box. You would need a local Postgres, a TCP tunnel, or Hyperdrive —
falling back to the very thing serverless Postgres is supposed to remove.

**This package runs real Drizzle migrations over HTTP**, one statement at a time.

## What it does

- Reads your Drizzle `meta/_journal.json` to get the ordered migration list
- Splits each `.sql` file into individual statements (string-literal-aware)
- Executes them via `sql.query(stmt)` — the explicit, string-accepting variant
- Skips idempotent `object already exists` errors so partially-applied states heal
- Records applied files by SHA-256 in `drizzle.__drizzle_migrations`
- Ships a CLI (`--dry-run`, `--dir`) and an importable runner API

## Quick start

```bash
npm install -D drizzle-migrate-neon-http @neondatabase/serverless
export DATABASE_URL="postgresql://user:pass@your-branch.neon.tech/db"

# after running `drizzle-kit generate`
drizzle-migrate-neon-http --dir ./drizzle --dry-run   # preview
drizzle-migrate-neon-http --dir ./drizzle             # apply
```

Programmatic:

```js
import { neon } from "@neondatabase/serverless";
import { runMigrations } from "drizzle-migrate-neon-http";

const sql = neon(process.env.DATABASE_URL);
await runMigrations({ sql, migrationsDir: "./drizzle" });
```

## Wait — there's more

Full docs live in the repo: [guide](https://gtnorbeat.github.io/drizzle-migrate-neon-http/guide/),
[advanced](https://gtnorbeat.github.io/drizzle-migrate-neon-http/advanced/),
[API reference](https://gtnorbeat.github.io/drizzle-migrate-neon-http/api/).

## License

MIT © [gaetano](https://github.com/gtnorbeat)