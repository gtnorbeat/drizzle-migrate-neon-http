/**
 * Split SQL text into individual executable statements.
 *
 * Neon's serverless HTTP driver (`@neondatabase/serverless` v1+) only accepts
 * single statements: `neon()` is a tagged-template function and cannot run
 * multi-statement SQL strings. Drizzle generates one file per migration with
 * many statements, so the file must be split before each statement can be sent.
 *
 * This splitter is deliberately naive-safe:
 *   - Semicolons inside single-quoted string literals are NOT treated as
 *     statement separators.
 *   - A backslash escapes the quote (PostgreSQL E'...'\\' ... handling).
 *   - `--` line comments are stripped before splitting so they never merge
 *     onto a following statement.
 *   - Empty / whitespace-only chunks are dropped.
 *
 * @param {string} text - Raw contents of a migration `.sql` file.
 * @returns {string[]} Trimmed, non-empty SQL statements in file order.
 */
export function splitStatements(text) {
  // Strip SQL single-line comments (-- to end of line) before splitting.
  // This prevents comments from merging with SQL when split on `;`.
  const cleaned = text.replace(/--.*$/gm, "");

  const statements = [];
  let current = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (!escaped && ch === "'") {
      inString = !inString;
    }
    escaped = !escaped && ch === "\\";

    if (!inString && ch === ";") {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}