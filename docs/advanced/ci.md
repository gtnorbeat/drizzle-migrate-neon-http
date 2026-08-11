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

## Testing the package itself (end-to-end)

The repository ships
[`script/e2e-neon.sh`](https://github.com/gtnorbeat/drizzle-migrate-neon-http/blob/main/script/e2e-neon.sh),
a real end-to-end test that exercises the package exactly like a user would:
create a database → generate migrations with `drizzle-kit` → dry-run → apply →
re-run (idempotency) → data roundtrip → FK enforcement → cleanup.

Two modes:

```bash
# Mode A — CI: creates a dedicated project, tests, deletes it
NEON_API_KEY=... NEON_ORG_ID=... script/e2e-neon.sh

# Mode B — your own database: tests and drops only what the test created
DATABASE_URL="postgresql://..." script/e2e-neon.sh
```

A `workflow_dispatch` Action (`.github/workflows/e2e-neon.yml`) runs mode A from
the Actions tab. Add `NEON_API_KEY` (and `NEON_ORG_ID` for personal keys) as
repository secrets first.