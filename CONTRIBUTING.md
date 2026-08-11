# Contributing to drizzle-migrate-neon-http

First off — thanks for taking the time to contribute! 🎉

This project is small and focused: it runs Drizzle migrations over Neon's
serverless HTTP driver, one statement at a time. Contributions that keep it
small, tested and well-documented are very welcome.

## Table of contents

- [Development setup](#development-setup)
- [Project conventions](#project-conventions)
- [Branching](#branching)
- [Contributors](#contributors)
- [Reporting issues](#reporting-issues)
- [Submitting a pull request](#submitting-a-pull-request)
- [Testing](#testing)
- [Documentation](#documentation)
- [Releasing](#releasing)
- [License](#license)

## Development setup

Requirements: **Node.js >= 18** and npm.

```bash
git clone https://github.com/gtnorbeat/drizzle-migrate-neon-http.git
cd drizzle-migrate-neon-http
npm install
```

Useful commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the test suite (`node --test`) |
| `npm run lint` | Lints `bin`, `src` and `test` with ESLint |
| `npm run migrate -- --dir ./drizzle --dry-run` | Tries the CLI against your own migrations |

Docs live on the separate [`docs` branch](#documentation) — see below.

## Project conventions

- **ESM only.** Source files use `.mjs`; types live next to them in `.d.mts`.
- **No runtime dependencies.** The only external package at runtime is
  `@neondatabase/serverless`, declared as a *peerDependency*. New runtime deps
  need a strong justification — raise it in a GitHub discussion before opening
  a PR that adds one.
- **Support Node 18+.** New syntax must work on Node 18.
- **Focused scope.** This is a migration runner, not an ORM. Features that
  belong in other tools are better contributed upstream.
- **Conventional Commits.** Commit messages use prefixes like:
  `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`, `refactor:`.
  This keeps the changelog greppable and matches the existing history.

## Branching

- **`agent/*`** — all day-to-day work. Create one branch per change:
  ```bash
  git checkout -b agent/your-feature
  ```
  Branches are pushed to the repo directly; keep them small and reviewable.
- **`main`** — only the latest **stable** version of the package. Code lands
  here only when it is released (bump + tag, see [Releasing](#releasing)).
  Never push work-in-progress straight to `main`.
- **`docs`** — the VitePress site. Documentation changes go here
  (see [Documentation](#documentation)).

> The `agent/*` / `main` / `docs` layout is the **maintainer's** workflow.
> External contributors don't need any of it — see
> [Contributors](#contributors).

## Contributors

Contributors **don't need branches, clones or the `agent/*` workflow** —
that's the maintainer's. To add yourself to the
[contributors list](CONTRIBUTORS.md):

1. Open a pull request that touches **only** `CONTRIBUTORS.md` — add your
   username keeping the list alphabetical. You can do it straight from the
   GitHub web editor, no local setup needed.
2. Or mention it in an issue/PR and the maintainer will add you.

That's it — no branching convention, no tests, no local setup.

## Reporting issues

Before opening an issue:

1. **Search** existing issues and the [docs](https://gtnorbeat.github.io/drizzle-migrate-neon-http/)
   — your question may already be answered.
2. Use the [issue templates](https://github.com/gtnorbeat/drizzle-migrate-neon-http/issues/new/choose):
   - **Bug report** — include a minimal reproduction (migration `.sql` file or
     script) and your versions.
   - **Feature request** — explain the problem you're solving, not just the
     feature name.

A good bug report contains: package version, Node version,
`@neondatabase/serverless` version, the exact command you ran, and the full
error output.

## Submitting a pull request

1. **Fork** the repo and create a branch (see [Branching](#branching)):
   ```bash
   git checkout -b agent/your-feature
   ```
2. Make your change — keep it **small and focused**. One PR = one concern.
3. Add or update **tests** in `test/` (`*.test.mjs`, run with `node --test`).
4. Run the checks:
   ```bash
   npm test
   npm run lint
   ```
   Both must pass.
5. If you changed CLI or API behaviour, update the docs on the [`docs` branch](https://github.com/gtnorbeat/drizzle-migrate-neon-http/tree/docs).
6. Open the PR using the [pull request template](.github/PULL_REQUEST_TEMPLATE.md).

### Before you push, double-check

- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] Tests cover the new behaviour (not just the happy path)
- [ ] Docs updated if the public API/CLI changed
- [ ] Commit message follows Conventional Commits

### Reviewer expectations

- The diff is the smallest that solves the problem.
- Edge cases (empty migrations, malformed SQL, partially-applied state) are
  covered — the splitter and the runner are the riskiest parts of this codebase.
- No new runtime dependencies without discussion.

## Testing

Tests use the built-in Node test runner (`node --test`), so there's no test
framework to learn:

```bash
npm test
```

When you add a feature, add tests for:

- the **happy path**
- the **failure paths** (bad arguments, missing `DATABASE_URL`, malformed SQL)
- the **idempotency guarantees** the package advertises

### End-to-end test on Neon

Beyond the unit tests, [`script/e2e-neon.sh`](script/e2e-neon.sh) runs a real
end-to-end test: it creates a Neon database, generates migrations with
`drizzle-kit`, runs the CLI's dry-run + apply, checks idempotency, a data
roundtrip and FK enforcement, then cleans up after itself.

```bash
# Mode A (CI): create a dedicated project, test, delete it
NEON_API_KEY=... NEON_ORG_ID=... script/e2e-neon.sh

# Mode B (your own database): test and drop only what the test created
DATABASE_URL="postgresql://..." script/e2e-neon.sh
```

A [`workflow_dispatch` workflow](.github/workflows/e2e-neon.yml) runs mode A
from the Actions tab — add `NEON_API_KEY` (and `NEON_ORG_ID` for personal
keys) as repository secrets first.

## Documentation

The docs are a VitePress site hosted at
[gtnorbeat.github.io/drizzle-migrate-neon-http](https://gtnorbeat.github.io/drizzle-migrate-neon-http/)
and maintained on the dedicated
[`docs` branch](https://github.com/gtnorbeat/drizzle-migrate-neon-http/tree/docs) —
this branch stays focused on the npm package. To work on them:

```bash
git clone -b docs https://github.com/gtnorbeat/drizzle-migrate-neon-http.git
cd drizzle-migrate-neon-http
npm install
npm run docs:dev
```

Update docs when you change:

- CLI flags or exit behaviour → `docs/cli.md`
- The programmatic API → `docs/api/`
- Guide-level behaviour → `docs/guide/`

Keep the tone beginner-friendly — the docs are read by people migrating a
database at 11pm. PRs touching docs go against the `docs` branch.

## Releasing

Maintainers publish via git tags; the [CI workflow](.github/workflows/publish.yml)
runs tests, lint and then publishes to npm automatically. `main` is
[protected](https://github.com/gtnorbeat/drizzle-migrate-neon-http/settings/branches)
— no direct pushes, not even for maintainers — so the bump goes through a PR:

```bash
# 1. on your agent/ branch — bump the version and tag locally
npm version patch   # or minor / major

# 2. push the branch and merge the bump into main via a pull request
git push origin agent/your-branch
# open a PR: agent/your-branch -> main, then merge it

# 3. push the tag to trigger the publish
git push origin v0.1.6
```

- The tag must match `package.json` version (`v0.1.3` → `0.1.3`).
- Publishing uses `--provenance` in CI, so keep the OIDC setup intact.
- Never edit an already-published version — bump and ship a new one.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
