# drizzle-migrate-neon-http

> Run Drizzle SQL migrations on Neon's serverless HTTP driver — no multi-statement
> SQL, no local Postgres emulation, no night sweats.

[![npm version](https://img.shields.io/npm/v/drizzle-migrate-neon-http.svg?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/drizzle-migrate-neon-http)
[![npm downloads](https://img.shields.io/npm/dm/drizzle-migrate-neon-http.svg?style=flat-square)](https://www.npmjs.com/package/drizzle-migrate-neon-http)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933.svg?style=flat-square&logo=node.js&logoColor=white)](package.json)
[![Docs](https://img.shields.io/badge/docs-VitePress-41b883.svg?style=flat-square)](https://gtnorbeat.github.io/drizzle-migrate-neon-http/)
[![CI](https://img.shields.io/github/actions/workflow/status/gtnorbeat/drizzle-migrate-neon-http/publish.yml.svg?style=flat-square)](https://github.com/gtnorbeat/drizzle-migrate-neon-http/actions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/gtnorbeat/drizzle-migrate-neon-http/pulls)

---

**📚 Full documentation:**
[gtnorbeat.github.io/drizzle‑migrate‑neon‑http](https://gtnorbeat.github.io/drizzle-migrate-neon-http/)
— getting started, CLI reference and API docs.

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

## Requirements

- **Node.js >= 18**
- A Drizzle migrations folder, generated with
  [`drizzle-kit generate`](https://orm.drizzle.team/docs/migrations) — the runner
  reads `meta/_journal.json` and the `NNNN_*.sql` files inside the folder
- A Neon (or Postgres-compatible) connection string, via the `DATABASE_URL`
  environment variable or the `--url` flag
- [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless)
  installed (peer dependency)

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

The docs are hosted at
[gtnorbeat.github.io/drizzle-migrate-neon-http](https://gtnorbeat.github.io/drizzle-migrate-neon-http/)
and maintained on the dedicated [`docs` branch](https://github.com/gtnorbeat/drizzle-migrate-neon-http/tree/docs):

- [Guide](https://gtnorbeat.github.io/drizzle-migrate-neon-http/guide/)
- [CLI reference](https://gtnorbeat.github.io/drizzle-migrate-neon-http/cli/)
- [Advanced](https://gtnorbeat.github.io/drizzle-migrate-neon-http/advanced/)
- [API reference](https://gtnorbeat.github.io/drizzle-migrate-neon-http/api/)

## Contributing

Found a bug? Want a feature? PRs are welcome and appreciated. 🤝

- Read the [Contributing Guidelines](CONTRIBUTING.md) — setup, conventions and
  testing in one page
- Use the [issue templates](https://github.com/gtnorbeat/drizzle-migrate-neon-http/issues/new/choose)
  to file a bug report or feature request
- Keep PRs small, tested (`npm test`) and linted (`npm run lint`)
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:` …)

## License

MIT © [astrocat986](https://www.npmjs.com/~astrocat986) — see [LICENSE](LICENSE)
