import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Same createRequire trick as bin/migrate.mjs — reading package.json with a
// direct import attribute would fail on Node < 20.10 and the bin guards the
// same regression this test protects.
const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, "..", "bin", "migrate.mjs");

// --help/--version short-circuit before URL validation, so no DATABASE_URL
// (and no network) is needed — the smoke test is fully hermetic.
const ENV = { ...process.env, DATABASE_URL: undefined };

function runBin(...args) {
  return execFileSync(process.execPath, [BIN, ...args], {
    env: ENV,
    encoding: "utf8",
    // Safety net: execFileSync blocks the event loop, so a hang here would
    // otherwise freeze the whole suite. On timeout the child is killed and the
    // test fails with status null — a clear failure beats a hang.
    timeout: 30000,
  });
}

/** Run the bin expecting a non-zero exit; returns the execFileSync error. */
function runBinExpectingFailure(...args) {
  try {
    runBin(...args);
  } catch (err) {
    return err; // Error with .status, .stdout and .stderr (utf8 strings)
  }
  assert.fail("expected the bin to exit non-zero");
}

const FIXTURES_DIR = join(__dirname, "fixtures", "basic");

test("bin --version prints the package version and exits 0", () => {
  const stdout = runBin("--version").trim();
  assert.equal(stdout, version);
});

test("bin -v (short flag) prints the package version", () => {
  const stdout = runBin("-v").trim();
  assert.equal(stdout, version);
});

test("bin --help prints usage and exits 0", () => {
  const stdout = runBin("--help");
  assert.match(stdout, /^drizzle-migrate-neon-http — Drizzle migrations on Neon's HTTP driver/);
  assert.match(stdout, /--dir <path>/);
  assert.match(stdout, /--dry-run/);
  assert.match(stdout, /--version, -v/);
});

test("bin -h (short flag) prints usage", () => {
  const stdout = runBin("-h");
  assert.match(stdout, /Usage:/);
  assert.match(stdout, /DATABASE_URL/);
});

test("bin --dry-run without DATABASE_URL fails with a clear error and exits 1", () => {
  const err = runBinExpectingFailure("--dry-run");
  assert.equal(err.status, 1);
  assert.match(String(err.stderr), /DATABASE_URL is required/);
});

test("bin --dry-run with a malformed --url fails fast in the neon() constructor", () => {
  const err = runBinExpectingFailure("--dry-run", "--url", "not-a-url");
  assert.equal(err.status, 1);
  // 'valid URL' comes from @neondatabase/serverless (peer dep); 'Migration
  // failed' is our own stable prefix — keep the assertion resilient to driver
  // message rewording.
  assert.match(String(err.stderr), /valid URL/);
  assert.match(String(err.stderr), /Migration failed/);
});

test("bin --dry-run with a fake connection string reaches the runner and fails on connect", () => {
  // fake.invalid is a reserved TLD (RFC 2606): DNS answers NXDOMAIN instantly,
  // so this fails fast without touching any real host. Only the bin's own
  // output is asserted, never the environment-specific network error text.
  const err = runBinExpectingFailure(
    "--dry-run",
    "--dir",
    FIXTURES_DIR,
    "--url",
    "postgresql://user:pass@fake.invalid/db",
  );
  assert.equal(err.status, 1);
  // The CLI parsed the options and entered the runner (dry-run banner printed)
  const stdout = String(err.stdout);
  assert.match(stdout, /Migrations dir:/);
  assert.match(stdout, /\(dry-run\)/);
  // ...then the connection to the fake host failed and main() reported it
  assert.match(String(err.stderr), /Migration failed/);
});
