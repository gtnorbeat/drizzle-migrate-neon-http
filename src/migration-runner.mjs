import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
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
 * @param {object} [ctx.log] - `{ log, warn }` functions; defaults to console.
 * @param {boolean} [ctx.dryRun] - Print statements without executing them.
 * @param {Set<string>} [ctx.alreadyApplied] - Pre-seeded applied hashes.
 */
export async function runMigrations({
  sql,
  migrationsDir,
  log = console,
  dryRun = false,
  alreadyApplied = null,
}) {
  const journalFile = join(migrationsDir, "meta", "_journal.json");
  if (!existsSync(journalFile)) {
    throw new Error(`Could not read journal: ${journalFile}`);
  }
  const journal = JSON.parse(readFileSync(journalFile, "utf8"));

  // Ensure the journal table exists (mirrors drizzle-kit's tracking).
  await sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`;
  await sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const appliedRows = alreadyApplied
    ? [...alreadyApplied].map((hash) => ({ hash }))
    : await sql`SELECT hash FROM "drizzle"."__drizzle_migrations"`;
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
        await executeStatement(sql, stmt);
      } catch (err) {
        log.error(`    statement ${i + 1} failed: ${err.message}`);
        log.error(`    SQL: ${stmt.slice(0, 200)}...`);
        throw err;
      }
    }

    await sql`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES (${hash}, ${Date.now()})`;
    log.log(`  [done] ${fileName}`);
  }
}

/**
 * Execute a single SQL statement via the Neon HTTP driver, skipping
 * idempotent "already exists" errors.
 */
async function executeStatement(sql, stmt) {
  try {
    return await sql.query(stmt);
  } catch (err) {
    if (isAlreadyExists(err?.code)) {
      console.log(`      (skipped — ${err?.message ?? "object already exists"})`);
      return [];
    }
    throw err;
  }
}

/** SHA-256 of a migration file's contents (used for change detection). */
function hashFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  return createHash("sha256").update(content).digest("hex");
}

export { dirname };