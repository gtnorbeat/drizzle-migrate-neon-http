# Rollbacks & history

## The model

The runner never deletes schema. It tracks *what has been applied* in
`drizzle.__drizzle_migrations`:

| id | hash | created_at |
|---|---|---|
| 1 | `a3f9c2...` | 1750000000000 |
| 2 | `8b1c07...` | 1750000060000 |

Each row is the SHA-256 of the applied `.sql` file. Because Drizzle migrations
are typically **forward-only** (schema changes accumulate), the package's
contract is: apply in order, skip known hashes, waterline advances.

## Inspecting what was applied

```sql
SELECT id,
       hash,
       to_timestamp(created_at / 1000.0) AS applied_at
FROM drizzle.__drizzle_migrations
ORDER BY id;
```

## Reverting manually

There is no `--down` flag. For most serverless Postgres work you don't want one:
true rollbacks require a **branch**, not a down-migration.

1. Cloudflare Workers + Neon → **branch everything**.
2. To roll back a bad release:
   - `neonctl branches create --name release-v1`
   - move `DATABASE_URL` to the new branch
   - redeploy

Forward migrations keep advancing only on the branch you choose. The old
database is preserved untouched — you can always repoint.

## Repairing a stuck waterline

If a migration *partially* applied before failing, re-run after fixing the
statement. The idempotent skip (see [error codes](/api/errors)) lets the
remaining statements land. A file whose hash is already recorded is never
re-executed; to force it, delete its row:

```sql
DELETE FROM drizzle.__drizzle_migrations WHERE hash = '<hash>';
```

Then re-run. Compare hashes against your files with:

```bash
sha256sum drizzle/0003_*.sql
```

## Editing old migrations

Because tracking is hash-based, editing an already-applied `.sql` file changes
its hash → it would be treated as *new* and applied again. Don't. Make a new
migration (`drizzle-kit generate`) for the delta; forward-only keeps history
honest and every environment in the same state.