# FAQ

Quick answers to the questions that come up most often. Each one links to the
page with the full story — and [Troubleshooting](/guide/troubleshooting) has
the exact errors and outputs if something is actively breaking.

## Do I still need drizzle-kit?

Yes — the two tools do different jobs:

- **`drizzle-kit generate`** creates the migrations: `0000_*.sql`,
  `0001_*.sql`, … and `meta/_journal.json` in your `out` directory.
- **`drizzle-migrate-neon-http`** applies them to Neon over the serverless
  HTTP driver, one statement at a time.

Point the `out` option of your `drizzle.config.ts` at your migrations
directory — the runner needs the `meta/_journal.json` that `drizzle-kit`
writes there. You can also drive the same runner from your own tooling with
[`runMigrations()`](/api/runMigrations). See
[Getting started](/guide/getting-started).

## Which connection string should I use?

Any `DATABASE_URL` Neon gives you for the branch — HTTP or pooled, both work,
because the driver negotiates over HTTP:

```bash
export DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/db"
```

Set it as an env var or pass it inline with `--url` (handy in CI with
ephemeral branch URLs). `--help` and `--version` work without a connection
string. If you're not sure the URL points where you think, verify it with
`psql` first — see
[Verify the connection with `psql`](/guide/troubleshooting#verify-the-connection-with-psql).

## Is it safe to run it again? What does `[skip]` mean?

Yes — runs are idempotent by design. Every fully-applied file is recorded by
the **SHA-256 of its contents** in `drizzle.__drizzle_migrations`, and hashes
the runner has already seen are skipped:

```
  [skip] 0001_add_users.sql — already applied
```

That's also what makes parallel CI runs safe: if two identical pipelines hit
the database at once, the second sees the hashes already applied and skips.
Want to preview first? `--dry-run` prints the ordered files and statement
counts without touching the database.

## What happens if a migration fails halfway?

The failed file's hash is **not** recorded — only fully-applied files are
saved in the tracking table. Fix the statement and re-run: the runner skips
the known "object already exists" PostgreSQL codes (`42P07`, `42701`,
`42710`, `42P16`, `42723`, `42P17`) so the remaining statements land and the
partial run **heals**. Every other error — a real failure, like a unique
violation (`23505`) — is re-thrown and stops the run, so nothing is silently
swallowed. See [error codes](/api/errors).

For transient HTTP failures, add `--retries 3`: a failed pass is retried with
exponential backoff, and completed files stay skipped, so the retry only
finishes what's missing.

## Why is my `.sql` file never applied?

The runner only walks `meta/_journal.json` — a `.sql` file that exists on
disk but isn't registered in the journal is invisible and never executed.
You'll see a warning:

```
[warn] 1 migration file(s) are not registered in meta/_journal.json and will NOT be applied:
  - 0010_add_thing.sql
```

This usually happens when a migration is copied into the folder without going
through `drizzle-kit generate`, or a commit lands with the file but not the
journal update. Fix it by registering the file in the journal (with the right
`tag`, `idx` and `when`) or removing the stray file — and run with `--strict`
in CI to turn the drift into a hard failure (exit code `1`) instead of a
warning.

## Can I edit a migration that has already been applied?

No. Tracking is hash-based, so editing an applied `.sql` file changes its
hash — the runner treats it as *new* and applies it again. Make a new
migration (`drizzle-kit generate`) for the delta instead: forward-only keeps
history honest and every environment in the same state.

If you genuinely need to force one file to re-run, delete its row from the
tracking table first — see
[Repairing a stuck waterline](/advanced/history#repairing-a-stuck-waterline).

## How do I roll back a migration?

There is no `--down` flag, and that's intentional. Drizzle migrations are
forward-only, and on serverless Postgres a true rollback is a **branch**, not
a down-migration:

```bash
neonctl branches create --name release-v1
# move DATABASE_URL to the new branch, redeploy
```

The old database is preserved untouched — you can always repoint. To inspect
what has been applied (or repair the waterline), query
`drizzle.__drizzle_migrations` directly — see
[Rollbacks & history](/advanced/history).
