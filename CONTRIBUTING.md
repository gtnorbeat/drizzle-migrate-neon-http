# Contributing to drizzle-migrate-neon-http

First off — thanks for taking the time to contribute! 🎉

This project is small and focused: it runs Drizzle migrations over Neon's
serverless HTTP driver, one statement at a time. Contributions that keep it
small, tested and well-documented are very welcome.

## Table of contents

- [Development setup](#development-setup)
- [Project conventions](#project-conventions)
- [Reporting issues](#reporting-issues)
- [Submitting a pull request](#submitting-a-pull-request)
- [Testing](#testing)
- [Documentation](#documentation)
- [Releasing](#releasing)
- [License](#license)

## Development setup

Requirements: **Node.js >= 18** and npm.

```bash
git clone https://github.com/astrocat86/drizzle-migrate-neon-http.git
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

## Reporting issues

Before opening an issue:

1. **Search** existing issues and the [docs](https://astrocat86.github.io/drizzle-migrate-neon-http/)
   — your question may already be answered.
2. Use the [issue templates](https://github.com/astrocat86/drizzle-migrate-neon-http/issues/new/choose):
   - **Bug report** — include a minimal reproduction (migration `.sql` file or
     script) and your versions.
   - **Feature request** — explain the problem you're solving, not just the
     feature name.

A good bug report contains: package version, Node version,
`@neondatabase/serverless` version, the exact command you ran, and the full
error output.

## Submitting a pull request

1. **Fork** the repo and create a branch:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Make your change — keep it **small and focused**. One PR = one concern.
3. Add or update **tests** in `test/` (`*.test.mjs`, run with `node --test`).
4. Run the checks:
   ```bash
   npm test
   npm run lint
   ```
   Both must pass.
5. If you changed CLI or API behaviour, update the docs on the [`docs` branch](https://github.com/astrocat86/drizzle-migrate-neon-http/tree/docs).
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

## Documentation

The docs are a VitePress site hosted at
[astrocat86.github.io/drizzle-migrate-neon-http](https://astrocat86.github.io/drizzle-migrate-neon-http/)
and maintained on the dedicated
[`docs` branch](https://github.com/astrocat86/drizzle-migrate-neon-http/tree/docs) —
this branch stays focused on the npm package. To work on them:

```bash
git clone -b docs https://github.com/astrocat86/drizzle-migrate-neon-http.git
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
runs tests, lint and then publishes to npm automatically:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

- The tag must match `package.json` version (`v0.1.3` → `0.1.3`).
- Publishing uses `--provenance` in CI, so keep the OIDC setup intact.
- Never edit an already-published version — bump and ship a new one.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
