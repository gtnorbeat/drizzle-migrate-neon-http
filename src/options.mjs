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
    strict: false,
    retries: 0,
    timeoutMs: null,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--version" || arg === "-v") opts.version = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--strict") opts.strict = true;
    else if (arg.startsWith("--dir=")) opts.dir = arg.slice("--dir=".length);
    else if (arg === "--dir") opts.dir = argv[argv.indexOf(arg) + 1] ?? opts.dir;
    else if (arg.startsWith("--url=")) opts.url = arg.slice("--url=".length);
    else if (arg === "--url") opts.url = argv[argv.indexOf(arg) + 1] ?? opts.url;
    else if (arg.startsWith("--retries=")) opts.retries = parseCount(arg.slice("--retries=".length), "--retries");
    else if (arg === "--retries") opts.retries = parseCount(argv[argv.indexOf(arg) + 1], "--retries");
    else if (arg.startsWith("--timeout=")) opts.timeoutMs = parseCount(arg.slice("--timeout=".length), "--timeout");
    else if (arg === "--timeout") opts.timeoutMs = parseCount(argv[argv.indexOf(arg) + 1], "--timeout");
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

/**
 * Parse a non-negative integer argument (retries, timeout). Rejects missing,
 * non-numeric or negative values with a flag-specific message.
 *
 * @param {string | undefined} value
 * @param {string} flag
 * @returns {number}
 */
function parseCount(value, flag) {
  const n = Number(value);
  if (value === undefined || value === "" || !Number.isInteger(n) || n < 0) {
    throw new Error(`${flag} expects a non-negative integer, got: ${value}`);
  }
  return n;
}
