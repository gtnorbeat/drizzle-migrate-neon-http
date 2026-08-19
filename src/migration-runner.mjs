import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { splitStatements } from "./split-statements.mjs";
import { isAlreadyExists } from "./errors.mjs";

/**
 * Run Drizzle migrations against a Neon HTTP connection.
 *
 * Implemented as an explicit `query()`-based runner because Neon's serverless
 * driver v1+ is tagged-template only: arbitrary SQL strings (the contents of
 * a migration file) must go through `sql.query(stmt)`, not `sql(template)`.
 *
 * @param {object} ctx
 * @param {Function} ctx.sql - A `neon()` query function (`sql.query(sqlString)`).
 * @param {string} ctx.migrationsDir - Directory containing `NNNN_*.sql` files
 *   and a Drizzle-style `meta/_journal.json` on its side.
 * @param {object} [ctx.log] - `{ log, warn, error }` functions; defaults to console.
 * @param {boolean} [ctx.dryRun] - Print statements without executing them.
 * @param {Set<string>} [ctx.alreadyApplied] - Pre-seeded applied hashes.
 * @param {boolean} [ctx.strict] - Fail (instead of warn) when `.sql` files are
 *   not registered in the journal.
 * @param {number} [ctx.retries] - Extra attempts after the first failure,
 *   with exponential backoff (default 0).
 * @param {number} [ctx.timeoutMs] - Per-query deadline in milliseconds. When
 *   set, a stalled HTTP call rejects instead of hanging forever.
 */
export async function runMigrations({
  sql,
  migrationsDir,
  log = console,
  dryRun = false,
  alreadyApplied = null,
  strict = false,
  retries = 0,
  timeoutMs = null,
}) {
  const journalFile = join(migrationsDir, "meta", "_journal.json");
  if (!existsSync(journalFile)) {
    throw new Error(`Could not read journal: ${journalFile}`);
  }
  const journal = JSON.parse(readFileSync(journalFile, "utf8"));

  assertNoOrphans(migrationsDir, journal, log, strict);

  const maxAttempts = retries + 1;
  for (let attempt = 1; ; attempt++) {
    try {
      await runOnce({ sql, migrationsDir, journal, log, dryRun, alreadyApplied, timeoutMs });
      return;
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
      warn(
        log,
        `migration attempt ${attempt}/${maxAttempts} failed: ${err.message} — retrying in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * A single migration pass: ensure tracking schema, load applied hashes, and
 * apply each journaled file one statement at a time. Safe to re-run — a
 * partially-applied file re-runs from its first statement and idempotent
 * "already exists" errors are skipped.
 */
async function runOnce({ sql, migrationsDir, journal, log, dryRun, alreadyApplied, timeoutMs }) {
  // Ensure the journal table exists (mirrors drizzle-kit's tracking).
  await withTimeout(
    sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`,
    timeoutMs,
    "CREATE SCHEMA",
  );
  await withTimeout(
    sql`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `,
    timeoutMs,
    "CREATE TABLE",
  );

  const appliedRows = alreadyApplied
    ? [...alreadyApplied].map((hash) => ({ hash }))
    : await withTimeout(
        sql`SELECT hash FROM "drizzle"."__drizzle_migrations"`,
        timeoutMs,
        "SELECT applied hashes",
      );
  const applied = new Set(appliedRows.map((r) => r.hash));

  for (const entry of journal.entries) {
    const fileName = `${entry.tag}.sql`;
    const filePath = join(migrationsDir, fileName);
    if (!existsSync(filePath)) {
      throw new Error(`Migration file not found: ${fileName}`);
    }

    const hash = hashFile(filePath);

    if (applied.has(hash)) {
      log.log(`  [skip] ${fileName} — already applied`);
      continue;
    }

    const sqlContent = readFileSync(filePath, "utf8");
    const statements = splitStatements(sqlContent);

    log.log(`  [apply] ${fileName} (${statements.length} statements)`);

    if (dryRun) {
      log.log(`    (dry-run, would execute ${statements.length} statements)`);
      continue;
    }

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      log.log(`    statement ${i + 1}/${statements.length}...`);
      try {
        await executeStatement(sql, stmt, log, timeoutMs);
      } catch (err) {
        log.error(`    statement ${i + 1} failed: ${err.message}`);
        log.error(`    SQL: ${stmt.slice(0, 200)}...`);
        throw err;
      }
    }

    await withTimeout(
      sql`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES (${hash}, ${Date.now()})`,
      timeoutMs,
      "INSERT migration record",
    );
    log.log(`  [done] ${fileName}`);
  }
}

/**
 * Execute a single SQL statement via the Neon HTTP driver, skipping
 * idempotent "already exists" errors.
 */
async function executeStatement(sql, stmt, log, timeoutMs) {
  try {
    return await withTimeout(sql.query(stmt), timeoutMs, `statement`);
  } catch (err) {
    if (isAlreadyExists(err?.code)) {
      log.log(`      (skipped — ${err?.message ?? "object already exists"})`);
      return [];
    }
    throw err;
  }
}

/**
 * Warn about `.sql` files present on disk but absent from the journal. These
 * are invisible to the runner and would never be applied — almost always a
 * mistake (a migration generated but not registered). Warn by default; throw
 * under `strict` so CI can turn the drift into a hard failure.
 */
function assertNoOrphans(migrationsDir, journal, log, strict) {
  const journaled = new Set(journal.entries.map((e) => `${e.tag}.sql`));
  const orphans = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !journaled.has(f))
    .sort();

  if (orphans.length === 0) return;

  const list = orphans.map((f) => `  - ${f}`).join("\n");
  const message =
    `${orphans.length} migration file(s) are not registered in ` +
    `meta/_journal.json and will NOT be applied:\n${list}\n` +
    `Register each entry in the journal (or remove the file) and re-run.`;

  if (strict) throw new Error(message);
  warn(log, `[warn] ${message}`);
}

/** SHA-256 of a migration file's contents (used for change detection). */
function hashFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  return createHash("sha256").update(content).digest("hex");
}

/** Race a driver call against a deadline so stalled HTTP calls can't hang. */
function withTimeout(promise, timeoutMs, label) {
  if (timeoutMs == null) return promise;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Log through `log.warn` when available, falling back to `log.log`. */
function warn(log, msg) {
  if (typeof log.warn === "function") log.warn(msg);
  else log.log(msg);
}
