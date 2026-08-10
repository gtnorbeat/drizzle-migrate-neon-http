/**
 * PostgreSQL error codes that indicate "object already exists" scenarios.
 *
 * Drizzle-generated migrations are NOT guaranteed to be fully re-runnable
 * against a partially-applied schema. These codes are safe to skip when
 * re-running older migrations — the object already being there is the desired
 * end state. All other errors are re-thrown.
 */
export const ALREADY_EXISTS_CODES = new Set([
  "42P07", // relation already exists
  "42701", // column already exists
  "42710", // object already exists
  "42P16", // cannot change number of columns
  "42723", // function already exists
  "42P17", // index already exists
]);

/** @param {string | undefined} code @returns {boolean} */
export function isAlreadyExists(code) {
  return ALREADY_EXISTS_CODES.has(code ?? "NO_CODE");
}