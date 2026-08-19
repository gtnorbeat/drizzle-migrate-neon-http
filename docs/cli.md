# CLI reference

```
drizzle-migrate-neon-http [options]
```

## Options

| Flag | Description | Default |
|---|---|---|
| `--dir <path>` | Directory containing `NNNN_*.sql` files and `meta/_journal.json` | `./drizzle` |
| `--dry-run` | Print statements without executing anything | `false` |
| `--url <dsn>` | Postgres connection string | `$DATABASE_URL` |
| `--strict` | Fail when a `.sql` file is missing from the journal (instead of warning) | `false` |
| `--retries <n>` | Extra attempts after a failed run, with exponential backoff | `0` |
| `--timeout <ms>` | Per-query deadline; a stalled query then fails fast | none |
| `--help`, `-h` | Show help text | |
| `--version`, `-v` | Print package version | |

## Environment

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connection string (required unless `--url` is passed) |

## Examples

```bash
# Preview against your branch
drizzle-migrate-neon-http --dir ./drizzle --dry-run

# Apply
drizzle-migrate-neon-http --dir ./drizzle

# Different migrations dir
drizzle-migrate-neon-http --dir ./packages/db/drizzle

# Connection string inline (CI with ephemeral DBs)
drizzle-migrate-neon-http --url "$BRANCH_URL" --dir ./drizzle

# Fail fast if a migration file was generated but never registered in the
# journal (it would otherwise be silently skipped)
drizzle-migrate-neon-http --dir ./drizzle --strict

# Retry transient HTTP failures instead of failing the whole run
drizzle-migrate-neon-http --dir ./drizzle --retries 3

# Give each query a deadline so a stalled connection fails instead of hanging
drizzle-migrate-neon-http --dir ./drizzle --timeout 15000
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success (or dry-run completed) |
| `1` | Missing `DATABASE_URL`, missing journal/file, orphaned files under `--strict`, or a statement failed |
| `2` | (Reserved) Invalid options |

## Output shape

Machine-readable enough for CI logs: one line per file
(`[apply]`, `[skip]`, `[done]`), one per statement with `statement N/M`.
Dry-run appends `(dry-run, would execute N statements)`.