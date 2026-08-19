#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
import { createRequire } from "module";
import { resolve } from "path";
import { parseOptions } from "../src/options.mjs";
import { runMigrations } from "../src/migration-runner.mjs";

// package.json is a JSON module: importing it directly requires an import
// attribute ("with { type: 'json' }") on Node 20.10+/22.10+/24+, which breaks
// on older supported runtimes. createRequire works on every Node >= 18.
const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const HELP = `drizzle-migrate-neon-http — Drizzle migrations on Neon's HTTP driver

Usage:
  drizzle-migrate-neon-http [options]

Options:
  --dir <path>     Directory containing NN_*.sql files + meta/_journal.json
                   (default: ./drizzle)
  --dry-run        Print statements without executing anything
  --url <dsn>      Postgres connection string (falls back to $DATABASE_URL)
  --strict         Fail when a .sql file is missing from the journal
  --retries <n>    Extra attempts after a failed run, with backoff (default: 0)
  --timeout <ms>   Per-query deadline; a stalled query then fails fast
  --help, -h       Show this help
  --version, -v    Print the package version

Environment:
  DATABASE_URL     Connection string (required unless --url is given)

The binary wraps @neondatabase/serverless's neon() query function. Because
that driver is tagged-template only, every SQL statement is sent individually
via sql.query(stmt). See README for why multi-statement strings break Neon HTTP.
`;

async function main() {
  const opts = parseOptions(process.argv.slice(2));

  if (opts.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (opts.version) {
    console.log(version);
    process.exit(0);
  }

  const sql = neon(opts.url);
  const migrationsDir = resolve(opts.dir);

  console.log(`▸ Migrations dir: ${migrationsDir}${opts.dryRun ? " (dry-run)" : ""}`);

  await runMigrations({
    sql,
    migrationsDir,
    dryRun: opts.dryRun,
    strict: opts.strict,
    retries: opts.retries,
    timeoutMs: opts.timeoutMs,
  });

  console.log("All migrations applied successfully.");
}

main().catch((err) => {
  console.error("Migration failed:", err.message ?? err);
  process.exit(1);
});
