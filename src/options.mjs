/**
 * CLI option parsing for the migrate binary.
 *
 * Supports plain flags and `key=value` pairs (repeatable), keeping the surface
 * small and CI-friendly:
 *
 *   drizzle-migrate-neon-http \
 *     --dir ./drizzle \
 *     --dry-run
 *
 * Environment variables are honoured as fallback:
 *   - DATABASE_URL          (required connection string)
 *
 * @param {string[]} argv  Process args without the node/script entries.
 * @returns {object} Resolved, validated options.
 */
export function parseOptions(argv) {
  const opts = {
    dir: "drizzle",
    dryRun: false,
    url: process.env.DATABASE_URL,
    help: false,
    version: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--version" || arg === "-v") opts.version = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--dir=")) opts.dir = arg.slice("--dir=".length);
    else if (arg === "--dir") opts.dir = argv[argv.indexOf(arg) + 1] ?? opts.dir;
    else if (arg.startsWith("--url=")) opts.url = arg.slice("--url=".length);
    else if (arg === "--url") opts.url = argv[argv.indexOf(arg) + 1] ?? opts.url;
  }

  // Informational flags never need a connection string.
  if (opts.help || opts.version) {
    return opts;
  }

  if (!opts.url) {
    throw new Error(
      "DATABASE_URL is required — set it as an env var or pass --url=postgresql://…",
    );
  }

  return opts;
}