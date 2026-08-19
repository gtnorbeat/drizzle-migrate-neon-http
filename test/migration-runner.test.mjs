import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "../src/migration-runner.mjs";
import { splitStatements } from "../src/split-statements.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "basic");

/** SHA-256 of a file, mirroring the runner's change-detection. */
function hashOf(filePath) {
  return createHash("sha256").update(readFileSync(filePath, "utf8")).digest("hex");
}

const HASH_0001 = hashOf(join(FIXTURES, "0001_init.sql"));
const HASH_0002 = hashOf(join(FIXTURES, "0002_users.sql"));

/**
 * A stand-in for the `neon()` query function from @neondatabase/serverless:
 * works as a tagged template AND exposes `query(stmt)`. Records every call so
 * tests can assert what the runner actually sent to the database.
 *
 * The runner only consumes the result of the SELECT-applied-hashes call, so
 * every tagged call resolving to the same `rows` is intentional.
 */
function makeSql({ rows = [], failures = {} } = {}) {
  const calls = { tagged: [], query: [] };
  const sql = (strings, ...values) => {
    calls.tagged.push(String.raw({ raw: strings }, ...values));
    return Promise.resolve(rows);
  };
  sql.query = (stmt) => {
    calls.query.push(stmt);
    const failure = failures[stmt];
    if (failure) return Promise.reject(failure);
    return Promise.resolve([]);
  };
  sql.calls = calls;
  return sql;
}

function makeLogger() {
  const lines = [];
  return {
    lines,
    log: (msg) => lines.push(msg),
    warn: (msg) => lines.push(msg),
    error: (msg) => lines.push(msg),
  };
}

test("applies migrations in journal order, one statement at a time, and records each hash", async () => {
  const sql = makeSql();
  const log = makeLogger();

  await runMigrations({ sql, migrationsDir: FIXTURES, log });

  // 2 setup (schema + tracking table) + 1 SELECT applied hashes + 2 INSERT records
  assert.equal(sql.calls.tagged.length, 5);
  assert.ok(
    sql.calls.tagged.some((t) => t.includes('SELECT hash FROM "drizzle"."__drizzle_migrations"')),
    "applied hashes are queried",
  );
  // Statements executed in order: 2 from 0001_init, 1 from 0002_users
  assert.equal(sql.calls.query.length, 3);
  assert.match(sql.calls.query[0], /CREATE TABLE IF NOT EXISTS "todos"/);
  assert.match(sql.calls.query[1], /INSERT INTO "todos"/);
  assert.match(sql.calls.query[2], /CREATE TABLE IF NOT EXISTS "users"/);
  // Both migrations recorded with their real hash
  assert.ok(sql.calls.tagged[3].includes(HASH_0001), "0001 hash recorded");
  assert.ok(sql.calls.tagged[4].includes(HASH_0002), "0002 hash recorded");
  // Logging
  assert.match(log.lines.join("\n"), /\[apply\] 0001_init\.sql \(2 statements\)/);
  assert.match(log.lines.join("\n"), /\[done\] 0001_init\.sql/);
  assert.match(log.lines.join("\n"), /\[done\] 0002_users\.sql/);
});

test("skips migrations whose hash is already applied", async () => {
  const sql = makeSql({ rows: [{ hash: HASH_0001 }, { hash: HASH_0002 }] });
  const log = makeLogger();

  await runMigrations({ sql, migrationsDir: FIXTURES, log });

  // 2 setup + 1 SELECT — no INSERT records, no statements executed
  assert.equal(sql.calls.tagged.length, 3);
  assert.equal(sql.calls.query.length, 0);
  const joined = log.lines.join("\n");
  assert.match(joined, /\[skip\] 0001_init\.sql — already applied/);
  assert.match(joined, /\[skip\] 0002_users\.sql — already applied/);
});

test("skips already-applied hashes passed via the alreadyApplied option without querying", async () => {
  const sql = makeSql();
  const log = makeLogger();

  await runMigrations({
    sql,
    migrationsDir: FIXTURES,
    log,
    alreadyApplied: new Set([HASH_0001, HASH_0002]),
  });

  // Only the 2 setup calls — the SELECT for applied hashes is skipped entirely
  assert.equal(sql.calls.tagged.length, 2);
  assert.equal(sql.calls.query.length, 0);
});

test("dry-run prints statements but executes nothing and records nothing", async () => {
  const sql = makeSql();
  const log = makeLogger();

  await runMigrations({ sql, migrationsDir: FIXTURES, log, dryRun: true });

  // 2 setup + 1 SELECT — no INSERTs and no executed statements
  assert.equal(sql.calls.tagged.length, 3);
  assert.equal(sql.calls.query.length, 0);
  const joined = log.lines.join("\n");
  assert.match(joined, /\(dry-run, would execute \d+ statements\)/);
  assert.doesNotMatch(joined, /\[done\]/);
});

test("records a comments-only migration without executing anything", async () => {
  const dir = mkdtempSync(join(tmpdir(), "runner-empty-"));
  try {
    mkdirSync(join(dir, "meta"));
    writeFileSync(
      join(dir, "meta", "_journal.json"),
      JSON.stringify({
        version: "7",
        dialect: "postgresql",
        entries: [
          { idx: 0, version: "7", when: 1, tag: "0001_notes", breakpoints: true },
        ],
      }),
    );
    writeFileSync(join(dir, "0001_notes.sql"), "-- placeholder: nothing to execute\n");

    const sql = makeSql();
    const log = makeLogger();
    await runMigrations({ sql, migrationsDir: dir, log });

    // 2 setup + 1 SELECT + 1 INSERT — the hash is recorded even with 0 statements
    assert.equal(sql.calls.tagged.length, 4);
    assert.equal(sql.calls.query.length, 0);
    assert.match(log.lines.join("\n"), /\[apply\] 0001_notes\.sql \(0 statements\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("throws when the journal file is missing", async () => {
  const sql = makeSql();
  const missingDir = join(tmpdir(), `no-journal-${Date.now()}`);

  await assert.rejects(
    runMigrations({ sql, migrationsDir: missingDir, log: makeLogger() }),
    /Could not read journal/,
  );
});

test("throws when a journaled migration file is missing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "runner-missing-"));
  try {
    mkdirSync(join(dir, "meta"));
    writeFileSync(
      join(dir, "meta", "_journal.json"),
      JSON.stringify({
        version: "7",
        dialect: "postgresql",
        entries: [
          { idx: 0, version: "7", when: 1, tag: "0009_nonexistent", breakpoints: true },
        ],
      }),
    );

    const sql = makeSql();
    await assert.rejects(
      runMigrations({ sql, migrationsDir: dir, log: makeLogger() }),
      /Migration file not found: 0009_nonexistent\.sql/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failing statement stops the migration and is not recorded", async () => {
  const stmts = splitStatements(readFileSync(join(FIXTURES, "0001_init.sql"), "utf8"));
  const sql = makeSql({ failures: { [stmts[0]]: new Error("boom: syntax error") } });
  const log = makeLogger();

  await assert.rejects(
    runMigrations({ sql, migrationsDir: FIXTURES, log }),
    /boom: syntax error/,
  );

  // 2 setup + 1 SELECT — the 0001 INSERT never happens because apply failed
  assert.equal(sql.calls.tagged.length, 3);
  assert.equal(sql.calls.query.length, 1);
  assert.match(log.lines.join("\n"), /statement 1 failed: boom: syntax error/);
});

test("'already exists' errors are skipped and the migration completes", async () => {
  const stmts = splitStatements(readFileSync(join(FIXTURES, "0001_init.sql"), "utf8"));
  const alreadyExists = Object.assign(new Error('relation "todos" already exists'), {
    code: "42P07",
  });
  const sql = makeSql({ failures: { [stmts[0]]: alreadyExists } });
  const log = makeLogger();

  await runMigrations({ sql, migrationsDir: FIXTURES, log });

  // Statement 1 skipped as idempotent, statement 2 executed, migration recorded
  assert.equal(sql.calls.query.length, 3);
  assert.equal(sql.calls.tagged.length, 5);
  assert.match(
    log.lines.join("\n"),
    /skipped — relation "todos" already exists/,
    "skip message routed through the injected logger",
  );
});

test("errors without an 'already exists' code are re-thrown even mid-migration", async () => {
  const stmts = splitStatements(readFileSync(join(FIXTURES, "0001_init.sql"), "utf8"));
  const foreignKeyError = Object.assign(new Error("violates foreign key constraint"), {
    code: "23503",
  });
  const sql = makeSql({ failures: { [stmts[1]]: foreignKeyError } });
  const log = makeLogger();

  await assert.rejects(
    runMigrations({ sql, migrationsDir: FIXTURES, log }),
    /violates foreign key constraint/,
  );

  // 0001 never recorded (no INSERT), statement 2 failed after statement 1 ran
  assert.equal(sql.calls.tagged.length, 3);
  assert.equal(sql.calls.query.length, 2);
});

/** Build a temp migrations dir with a journal and an arbitrary set of files. */
function makeDir({ entries, files }) {
  const dir = mkdtempSync(join(tmpdir(), "runner-orphan-"));
  mkdirSync(join(dir, "meta"));
  writeFileSync(
    join(dir, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "postgresql", entries }),
  );
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

const ORPHAN_ENTRY = { idx: 0, version: "7", when: 1, tag: "0001_known", breakpoints: true };

test("an unregistered .sql file warns but does not block the run", async () => {
  const dir = makeDir({
    entries: [ORPHAN_ENTRY],
    files: {
      "0001_known.sql": "-- nothing\n",
      "0002_orphan.sql": "CREATE TABLE IF NOT EXISTS stray ();\n",
    },
  });
  try {
    const sql = makeSql();
    const log = makeLogger();

    await runMigrations({ sql, migrationsDir: dir, log });

    const joined = log.lines.join("\n");
    assert.match(joined, /\[warn\]/);
    assert.match(joined, /0002_orphan\.sql/);
    assert.match(joined, /\[done\] 0001_known\.sql/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("strict mode fails fast on an unregistered .sql file", async () => {
  const dir = makeDir({
    entries: [ORPHAN_ENTRY],
    files: {
      "0001_known.sql": "-- nothing\n",
      "0002_orphan.sql": "CREATE TABLE IF NOT EXISTS stray ();\n",
    },
  });
  try {
    const sql = makeSql();
    const log = makeLogger();

    await assert.rejects(
      runMigrations({ sql, migrationsDir: dir, log, strict: true }),
      /0002_orphan\.sql/,
    );
    // Pre-flight: nothing was applied, not even the tracking schema.
    assert.equal(sql.calls.tagged.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("no warning when every .sql file is registered in the journal", async () => {
  const sql = makeSql();
  const log = makeLogger();

  await runMigrations({ sql, migrationsDir: FIXTURES, log });

  assert.doesNotMatch(log.lines.join("\n"), /\[warn\]/);
});

test("orphan warning falls back to log.log when the logger has no warn method", async () => {
  const dir = makeDir({
    entries: [ORPHAN_ENTRY],
    files: {
      "0001_known.sql": "-- nothing\n",
      "0002_orphan.sql": "CREATE TABLE IF NOT EXISTS stray ();\n",
    },
  });
  try {
    const sql = makeSql();
    const lines = [];
    const log = { log: (msg) => lines.push(msg) };

    await runMigrations({ sql, migrationsDir: dir, log });

    assert.match(lines.join("\n"), /0002_orphan\.sql/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("retries re-run after a transient failure and eventually succeed", async () => {
  let selectCalls = 0;
  const sql = (strings, ...values) => {
    const text = String.raw({ raw: strings }, ...values);
    if (text.includes("SELECT hash")) {
      selectCalls += 1;
      if (selectCalls === 1) return Promise.reject(new Error("connection reset"));
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  };
  sql.query = () => Promise.resolve([]);
  const log = makeLogger();

  await runMigrations({ sql, migrationsDir: FIXTURES, log, retries: 1 });

  assert.equal(selectCalls, 2);
  const joined = log.lines.join("\n");
  assert.match(joined, /attempt 1\/2 failed: connection reset/);
  assert.match(joined, /\[done\] 0002_users\.sql/);
});

test("retries give up once the retry budget is exhausted", async () => {
  const sql = () => Promise.reject(new Error("always down"));
  sql.query = () => Promise.resolve([]);
  const log = makeLogger();

  await assert.rejects(
    runMigrations({ sql, migrationsDir: FIXTURES, log, retries: 1 }),
    /always down/,
  );
  assert.match(log.lines.join("\n"), /attempt 1\/2 failed: always down/);
});

test("timeout rejects a stalled query instead of hanging forever", async () => {
  const sql = () => Promise.resolve([]);
  sql.query = () => new Promise(() => {}); // never settles
  const log = makeLogger();

  await assert.rejects(
    runMigrations({ sql, migrationsDir: FIXTURES, log, timeoutMs: 50 }),
    /timed out after 50ms/,
  );
});
