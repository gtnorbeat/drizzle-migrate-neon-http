import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOptions } from "../src/options.mjs";

const URL = "postgresql://user:pass@ep-test.aws.neon.tech/neondb?sslmode=require";

/** Set/clear DATABASE_URL for a single test, always restoring the previous value. */
function withEnv(url, fn) {
  const prev = process.env.DATABASE_URL;
  if (url === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = url;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;
  }
}

test("parseOptions defaults: dir=drizzle, dryRun=false, url from DATABASE_URL", () => {
  withEnv(URL, () => {
    const opts = parseOptions([]);
    assert.equal(opts.dir, "drizzle");
    assert.equal(opts.dryRun, false);
    assert.equal(opts.url, URL);
    assert.equal(opts.help, false);
    assert.equal(opts.version, false);
  });
});

test("parseOptions --dry-run sets dryRun without touching other defaults", () => {
  withEnv(URL, () => {
    const opts = parseOptions(["--dry-run"]);
    assert.equal(opts.dryRun, true);
    assert.equal(opts.dir, "drizzle");
    assert.equal(opts.url, URL);
  });
});

test("parseOptions --dir=value and --dir value both set the directory", () => {
  withEnv(URL, () => {
    assert.equal(parseOptions(["--dir=./custom"]).dir, "./custom");
    assert.equal(parseOptions(["--dir", "./other"]).dir, "./other");
  });
});

test("parseOptions --dir without a value keeps the default", () => {
  withEnv(URL, () => {
    assert.equal(parseOptions(["--dir"]).dir, "drizzle");
  });
});

test("parseOptions --url=value overrides DATABASE_URL; --url value works too", () => {
  withEnv("postgresql://wrong", () => {
    assert.equal(parseOptions(["--url=postgresql://right"]).url, "postgresql://right");
    assert.equal(parseOptions(["--url", "postgresql://right2"]).url, "postgresql://right2");
  });
});

test("parseOptions --help and -h return early without requiring a connection string", () => {
  withEnv(undefined, () => {
    assert.equal(parseOptions(["--help"]).help, true);
    assert.equal(parseOptions(["-h"]).help, true);
  });
});

test("parseOptions --version and -v return early without requiring a connection string", () => {
  withEnv(undefined, () => {
    assert.equal(parseOptions(["--version"]).version, true);
    assert.equal(parseOptions(["-v"]).version, true);
  });
});

test("parseOptions throws a clear error when no connection string is available", () => {
  withEnv(undefined, () => {
    assert.throws(
      () => parseOptions([]),
      /DATABASE_URL is required/,
    );
  });
});

test("parseOptions ignores unknown flags instead of failing", () => {
  withEnv(URL, () => {
    const opts = parseOptions(["--verbose", "--wat"]);
    assert.equal(opts.dir, "drizzle");
    assert.equal(opts.url, URL);
  });
});
