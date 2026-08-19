# Troubleshooting

Common issues, the exact error you'll see, and how to fix them.

## `DATABASE_URL is required`

**Error:**
```
Error: DATABASE_URL is required — set it as an env var or pass --url=postgresql://…
```

**Cause:** the CLI needs a connection string, and neither `DATABASE_URL` nor
`--url` was provided.

**Fix:**
```bash
export DATABASE_URL="postgresql://user:pass@your-branch.neon.tech/db"
# or, per-run:
drizzle-migrate-neon-http --url "postgresql://user:pass@your-branch.neon.tech/db"
```

`--help` and `--version` never need a connection string — they work without it.

## Verify the connection with `psql`

Unsure whether `DATABASE_URL` points where you think? Check it directly with
`psql` using Neon's universal hostname — role names are globally unique, so
Neon routes to the right project automatically:

```bash
psql -h pg.neon.tech -U <role-name> -d <database-name>
```

Use the `user` and `database` parts of your connection string for
`<role-name>` and `<database-name>`. Connections require SSL — add
`sslmode=require` if your client doesn't default to it — and `pg.neon.tech` is
the **direct** endpoint on port 5432. For the connection pooler, use the
pooled connection string from the Neon console instead.

If `psql` connects but the runner still fails, the problem is in the migration
folder or the script, not the network.

## `Could not read journal`

**Error:**
```
Error: Could not read journal: ./drizzle/meta/_journal.json
```

**Cause:** the folder passed to `--dir` isn't a Drizzle migrations folder, or
migrations haven't been generated yet.

**Fix:** generate migrations first:
```bash
npx drizzle-kit generate
drizzle-migrate-neon-http --dir ./drizzle --dry-run
```
The default `--dir` is `./drizzle`.

## `Migration file not found`

**Error:**
```
Error: Migration file not found: 0000_xyz.sql
```

**Cause:** the journal (`meta/_journal.json`) references a `.sql` file that
isn't in the folder — deleted, renamed, or an incomplete copy.

**Fix:** every file listed in the journal must exist next to it. Restore the
missing file or regenerate the migrations.

## A `.sql` file is present but never applied

**Output:**
```
[warn] 1 migration file(s) are not registered in meta/_journal.json and will NOT be applied:
  - 0010_add_thing.sql
```

**Cause:** the runner only walks the journal (`meta/_journal.json`), so a `.sql`
file that exists on disk but is *not* registered in the journal is invisible —
it is never executed. This usually happens when a migration is copied into the
folder without going through `drizzle-kit generate` (which writes the journal
entry), or when a commit lands with the file but not the journal update.

The classic symptom downstream is a missing table or `column "…" does not
exist` error in code that expects the migration to have run.

**Fix:** register the file in the journal (add the matching entry with the
right `tag`, `idx` and `when`), or remove the stray file. To make this drift a
hard failure in CI instead of a warning, run with `--strict`:

```bash
drizzle-migrate-neon-http --dir ./drizzle --strict
```

## Migrations are skipped as "already applied"

**Output:**
```
  [skip] 0000_init.sql — already applied
```

**Cause:** the runner records each applied file by the **SHA-256 of its
contents** in `drizzle.__drizzle_migrations`, and skips hashes it has already
seen. This is by design: runs are idempotent.

**Note:** skipping is based on the file *hash*, so if you edit a migration file
its hash changes and it will be re-applied on the next run.

## Idempotent "object already exists" errors

**Output:**
```
      (skipped — relation "users" already exists, skipping)
```

**Cause:** Drizzle migrations aren't guaranteed to be re-runnable against a
partially-applied schema. The runner skips these PostgreSQL error codes —
the object already existing is the desired end state:

`42P07` relation · `42701` column · `42710` object · `42P16` columns · `42723` function · `42P17` index

**Important:** every *other* error is re-thrown and stops the run — a real
failure is never silently swallowed.

## A statement failed

**Error:**
```
    statement 3 failed: syntax error at or near "INERT"
    SQL: INERT INTO users ...
```

**Cause:** the Neon driver rejected the statement — usually malformed SQL in a
migration file.

**Fix:** correct the statement in the `.sql` file and re-run. The file's hash
changes, so it won't be treated as already applied. Note that the failed file's
hash is **not** recorded: only fully-applied files are saved in
`drizzle.__drizzle_migrations`.

## First run creates the `drizzle` schema

On first use the runner creates the tracking table
`drizzle.__drizzle_migrations` (mirroring drizzle-kit's own tracking). If you
already have that table with a different shape, the runner uses it as-is and
skips files whose recorded hashes match.
