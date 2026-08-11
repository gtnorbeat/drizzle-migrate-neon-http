#!/usr/bin/env node
/**
 * Release-tag validation gate, run by the publish workflow on every `v*` tag.
 *
 * Checks:
 *   1. The tag is valid plain SemVer: `vX.Y.Z` (no pre-release/build metadata).
 *   2. The tag matches `package.json` version (`v1.2.3` -> `1.2.3`).
 *   3. The bump from the previous `v*` tag is coherent — exactly one of
 *      MAJOR / MINOR / PATCH increments by 1, with lower segments reset to 0
 *      (minor and major bumps). Duplicate tags and downgrades are rejected.
 *      This mirrors the policy in CONTRIBUTING.md -> Releasing.
 *
 * Usage:
 *   node script/check-release.mjs <tag>      # e.g. v0.1.9
 *
 * Exit codes: 0 = valid, 1 = invalid release, 2 = usage error.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

/** Parse a tag into `[major, minor, patch]` or return null when malformed. */
export function parseTag(tag) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** True when `next` is exactly one MAJOR/MINOR/PATCH step above `prev`. */
export function isCoherentBump(prev, next) {
  const [pmaj, pmin, ppatch] = prev;
  const [maj, min, patch] = next;
  return (
    (maj === pmaj + 1 && min === 0 && patch === 0) || // major bump
    (maj === pmaj && min === pmin + 1 && patch === 0) || // minor bump
    (maj === pmaj && min === pmin && patch === ppatch + 1) // patch bump
  );
}

function cmpParts(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function gitTags() {
  return execFileSync("git", ["tag", "--list", "v*"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

/** Fail with an Actions `::error::` annotation in CI, plain output locally. */
function fail(message) {
  const prefix = process.env.GITHUB_ACTIONS === "true" ? "::error::" : "";
  console.error(prefix + message);
  process.exit(1);
}

function main() {
  const tag = process.argv[2];
  if (!tag) {
    console.error("usage: node script/check-release.mjs <tag>");
    process.exit(2);
  }

  const next = parseTag(tag);
  if (!next) {
    fail(
      `✖ "${tag}" is not a valid release tag — expected vX.Y.Z ` +
        "(plain SemVer, no pre-release/build metadata)",
    );
  }

  const pkg = require("../package.json");
  if (pkg.version !== tag.slice(1)) {
    fail(
      `✖ tag ${tag} does not match package.json version ${pkg.version} — ` +
        "bump the version first (npm version patch|minor|major)",
    );
  }

  // The current tag is always in the list when running from CI, so exclude it
  // before looking for the previous release and for accidental duplicates.
  const versions = gitTags()
    .filter((t) => t !== tag)
    .map((t) => ({ tag: t, parts: parseTag(t) }))
    .filter((x) => x.parts);

  const dup = versions.find((x) => cmpParts(x.parts, next) === 0);
  if (dup) {
    fail(
      `✖ tag ${tag} duplicates the version of an existing tag ${dup.tag} — ` +
        "never re-publish a version",
    );
  }

  const prev = versions
    .filter((x) => cmpParts(x.parts, next) < 0)
    .sort((a, b) => cmpParts(a.parts, b.parts))
    .pop();

  if (prev && !isCoherentBump(prev.parts, next)) {
    fail(
      `✖ bump from ${prev.tag} to ${tag} is not coherent — exactly one of ` +
        "MAJOR/MINOR/PATCH must increment by 1 (minor/major reset the lower " +
        "segments). See CONTRIBUTING.md → Releasing.",
    );
  }

  console.log(
    `✅ ${tag}: valid SemVer, matches package.json ${pkg.version}, ` +
      `coherent bump from ${prev ? prev.tag : "(first release)"}`,
  );
}

// Run only when executed directly, so the pure helpers can be unit-tested.
// pathToFileURL normalizes relative/absolute invocations, unlike a raw string
// compare — a silent no-op here would disable the release gate entirely.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
