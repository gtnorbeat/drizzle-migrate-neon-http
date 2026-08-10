# Getting started

## Install

```bash
npm install -D drizzle-migrate-neon-http @neondatabase/serverless
```

The package exposes a CLI (`drizzle-migrate-neon-http`) and an importable API.
`@neondatabase/serverless` is a **peer dependency** — you provide the driver;
the package provides the runner.

## 1. Generate migrations

Use Drizzle as usual. Make sure your `drizzle.config.ts` writes to a directory
with a `meta/_journal.json`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle", // ← journals + .sql live here
  dialect: "postgresql",
});
```

```bash
drizzle-kit generate
```

The `out` directory will contain `0000_*.sql`, `0001_*.sql`, … and
`meta/_journal.json`.

## 2. Set your connection string

Neon gives you the `DATABASE_URL` for your branch (HTTP or pooled — both work,
the driver negotiates over HTTP):

```bash
export DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/db"
```

## 3. Dry-run first

Preview exactly what will execute without touching the database:

```bash
drizzle-migrate-neon-http --dir ./drizzle --dry-run
```

You'll see the ordered list of files and statement counts.

## 4. Apply

```bash
drizzle-migrate-neon-http --dir ./drizzle
```

Output:

```
▸ Migrations dir: /repo/drizzle
  [apply] 0000_dry_serpent.sql (3 statements)
    statement 1/3...
    statement 2/3...
    statement 3/3...
  [done] 0000_dry_serpent.sql
  [skip] 0001_add_users.sql — already applied
All migrations applied successfully.
```

Applied files are recorded by SHA-256, so re-running is a no-op and edits to an
already-applied file are caught (different hash → it will try to apply the new
version, which the idempotent error handling turns into a heal).

## Next steps

- [CLI reference](/cli) — all flags
- [Programmatic API](/api/runMigrations) — use it from your own tooling
- [Monorepo & CI](/advanced/ci) — wiring into GitLab/GitHub pipelines