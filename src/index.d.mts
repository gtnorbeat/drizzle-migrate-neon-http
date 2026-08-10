/**
 * Type declarations for drizzle-migrate-neon-http.
 *
 * The implementation is plain ESM (JSDoc-typed); this file mirrors the public
 * API surface so TypeScript consumers get accurate types.
 */

/** The `neon()` query function from `@neondatabase/serverless` (v1+). */
export type NeonQueryFunction = {
  /** Tagged-template form — the only form the HTTP driver accepts. */
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  /** Explicit string form, used by this package for migration statements. */
  query(query: string): Promise<unknown[]>;
};

/** Logger shape accepted by {@link runMigrations}. */
export interface MigrationLogger {
  log(message?: unknown, ...optionalParams: unknown[]): void;
  warn?(message?: unknown, ...optionalParams: unknown[]): void;
  error?(message?: unknown, ...optionalParams: unknown[]): void;
}

/** Options accepted by {@link runMigrations}. */
export interface RunMigrationsOptions {
  /** The `neon()` query function (with `.query()` support). */
  sql: NeonQueryFunction;
  /** Directory containing `NNNN_*.sql` files and `meta/_journal.json`. */
  migrationsDir: string;
  /** Custom logger; defaults to `console`. */
  log?: MigrationLogger;
  /** Print statements without executing them. */
  dryRun?: boolean;
  /** Pre-seeded set of already-applied file hashes. */
  alreadyApplied?: Set<string> | null;
}

/**
 * Run Drizzle migrations against a Neon HTTP connection, one statement at a time.
 */
export declare function runMigrations(
  options: RunMigrationsOptions,
): Promise<void>;

/**
 * Split SQL text into individual executable statements (string-literal-aware,
 * comment-safe). Semicolons inside single-quoted strings are preserved.
 */
export declare function splitStatements(text: string): string[];

/**
 * PostgreSQL error codes for "object already exists" scenarios that are safe
 * to skip when re-running older migrations.
 */
export declare const ALREADY_EXISTS_CODES: ReadonlySet<string>;

/** @returns true when `code` indicates an "already exists" error. */
export declare function isAlreadyExists(code: string | undefined): boolean;
