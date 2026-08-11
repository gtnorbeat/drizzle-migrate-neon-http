# Versioning & releases

The package follows [Semantic Versioning](https://semver.org/)
(`MAJOR.MINOR.PATCH`). It is currently on **`0.x`**, which per SemVer means the
public API is not yet considered stable — this page explains how each number
is chosen, so you know what to expect from an update.

## How a version number is chosen

| Bump | When | Example |
|---|---|---|
| **`patch`** | Bug fixes and internal fixes only. Behaviour changes solely by fixing bugs; no new features. README/LICENSE-only refreshes also ship here. | `0.1.8` → `0.1.9` |
| **`minor`** | New features: new CLI flags, new API options, non-breaking additions. While on `0.x`, any **breaking** change to the public API also lands here — announced in the release notes. | `0.1.9` → `0.2.0` |
| **`major`** | Reserved for `1.0.0`, when the public API is declared stable. From `1.x` onwards strict SemVer applies: minor = additive, major = breaking. | `0.2.0` → `1.0.0` |

**Rule of thumb:** *would an existing script that uses the package change
behaviour or need touching?*

- **No** → `patch`
- **It only adds options** → `minor`
- **It breaks** → `minor` (until 1.0) / `major` (after)

## What triggers a release

Not every change to the repository produces a new npm version. The package
ships only `bin/`, `src/`, `README.md` and `LICENSE` (the `files` field in
`package.json`):

- **A release is needed** only for changes to those files or to
  `package.json` metadata (deps, engines, …).
- **No release is needed** for the test suite, CI workflows, this
  documentation site or the contributors list.

Several small commits are batched into a single release — version numbers
mean something, they aren't a per-commit counter.

## How a release ships

1. A maintainer bumps the version and pushes a **git tag** (`v0.1.8` →
   `0.1.8`, tag and `package.json` must match).
2. The tag automatically triggers the **end-to-end test on Neon** (see
   [Monorepo & CI](/advanced/ci)).
3. The publish workflow **waits for that test to pass** before running
   `npm publish` — a release with a broken migration lifecycle never reaches
   npm.

You can always check the current version with:

```bash
npm view drizzle-migrate-neon-http version
```

## For contributors

The full release policy — what requires a version bump, how to choose between
patch/minor/major, and the tag workflow — is documented for maintainers in the
[Releasing section of CONTRIBUTING.md](https://github.com/gtnorbeat/drizzle-migrate-neon-http/blob/main/CONTRIBUTING.md#releasing).
A release gate in CI also validates every tag automatically (SemVer + match
with `package.json` + coherent bump), so a malformed release never reaches
npm.
