# Monorepo & CI

A migration utility earns its keep in pipelines. Hook the binary into any
runner that has network access to Neon — Web Workers execute fetch, which is
exactly what the HTTP driver uses.

## GitLab CI

```yaml
migrate:
  image: node:22-alpine
  stage: migrate
  only:
    - main
  script:
    - npm ci
    - export DATABASE_URL="$PRODUCTION_DATABASE_URL"
    - npx drizzle-migrate-neon-http --dir ./packages/db/drizzle
```

Set `PRODUCTION_DATABASE_URL` as a protected CI/CD variable.

## GitHub Actions

```yaml
name: migrate
on:
  push:
    branches: [main]
jobs:
  migrate:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx drizzle-migrate-neon-http --dir ./packages/db/drizzle
```

## Neon branching for preview environments

Combine with Neon's branching so each MR migrates its own schema before deploy:

```bash
# create branch, get its URL
npx neonctl branches create --name preview-123
BRANCH_URL=$(npx neonctl connection-string --branch preview-123 --pooled)

# migrate exactly that branch, then point the app at it
drizzle-migrate-neon-http --url "$BRANCH_URL" --dir ./drizzle
```

Because the runner is a plain binary over `DATABASE_URL`, you can run it *before*
deploying the preview — no extra scaffolding needed.

## Idempotency in parallel runs

The `drizzle.__drizzle_migrations` table uses a `created_at bigint` timestamp and
a hash. If two identical pipelines hit the database at once, the second sees the
hash already applied and skips. Keep `--dry-run` for prod rehearsals, real runs
only where they're supposed to land.

## End-to-end test

The repository ships
[`script/e2e-neon.sh`](https://github.com/gtnorbeat/drizzle-migrate-neon-http/blob/main/script/e2e-neon.sh):
a real end-to-end test that exercises the package exactly like a user would.
It installs the packed tarball (honoring the `files` field, so it tests
precisely what npm ships), generates migrations with `drizzle-kit` and runs the
full migration lifecycle against a real Neon database.

### What it verifies

1. **Migrations** — generates two migrations from a schema with FK + indexes
2. **Dry-run** — detects both pending migrations without touching the schema
3. **Apply** — runs both, recorded in `drizzle.__drizzle_migrations`
4. **Idempotency** — a re-run skips everything as already applied
5. **Data roundtrip** — INSERT + JOIN across `users`/`posts`/`comments`
6. **FK enforcement** — a violating INSERT is rejected (error `23503`)

It exits `0` on success and `1` on the first failure. Requires `node`, `npm`
and `curl` on the PATH.

### Mode A — dedicated project (CI)

Creates a throwaway Neon project, tests against it and **deletes the project**
afterwards (even on failure, via an EXIT trap). Nothing else is touched.

```bash
NEON_API_KEY=... script/e2e-neon.sh
```

| Variable | Required | Notes |
|---|---|---|
| `NEON_API_KEY` | ✅ | Neon API key (console.neon.tech → Settings → API keys) |
| `NEON_ORG_ID` | 🔸 | Only for *personal* keys; org-scoped keys auto-detect it |
| `NEON_REGION` | no | Project region (default `aws-us-east-2`) |
| `NEON_PG` | no | Postgres major version (default `16`) |
| `KEEP_PROJECT=1` | no | Keep the project after the test (debugging) |

### Mode B — your own database

Runs against an existing database and **drops only the tables/schema the test
created** (`users`, `posts`, `comments`, `drizzle` schema) — everything else is
left untouched.

```bash
DATABASE_URL="postgresql://user:pass@ep-….neon.tech/db?sslmode=require" script/e2e-neon.sh
```

`NEON_API_KEY` and `DATABASE_URL` are mutually exclusive.

### Expected output

```text
▸ drizzle-migrate-neon-http — end-to-end test on Neon (mode: api)
▸ creating project drizzle-migrate-e2e-…
▸ generating migrations (drizzle-kit)…
▸ dry-run (must detect 2 pending migrations and touch nothing)…
▸ apply (must run both migrations)…
▸ re-run (must skip both as already applied)…
▸ data roundtrip + FK enforcement…
▸ PASS — drizzle-migrate-neon-http v0.1.7 works end-to-end on Neon
  [cleanup] deleting test project …
```

### From CI

`.github/workflows/e2e-neon.yml` runs mode A from the Actions tab
(`workflow_dispatch`). Set `NEON_API_KEY` (and `NEON_ORG_ID` for personal
keys) as repository secrets first, then **Actions → “E2E on Neon” → Run
workflow**. The same job can be attached to release tags by uncommenting the
`push:` block in the workflow file.