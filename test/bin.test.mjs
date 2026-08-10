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

// --help/--version are handled after parseOptions() validates the URL, so a
// placeholder DSN keeps the smoke test hermetic (no network, no env deps).
const ENV = { ...process.env, DATABASE_URL: "postgresql://user:pass@placeholder/db" };

function runBin(...args) {
  return execFileSync(process.execPath, [BIN, ...args], {
    env: ENV,
    encoding: "utf8",
  });
}

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
