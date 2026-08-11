#!/usr/bin/env bash
# =====================================================================
# e2e-neon.sh — real end-to-end test for drizzle-migrate-neon-http.
#
# Generates migrations with drizzle-kit, runs the CLI's dry-run + apply
# against a real Neon database, checks idempotency, a data roundtrip and
# FK enforcement, then cleans up after itself. Fails with exit 1 if any
# step does not behave as expected.
#
# Two modes:
#   A) API mode (default, for CI):  NEON_API_KEY set
#        creates a dedicated project, tests against it, deletes it.
#        Nothing of your existing projects is touched.
#   B) BYO database:                DATABASE_URL set (no NEON_API_KEY)
#        runs against that database and drops ONLY the tables/schema the
#        test created, leaving everything else as it was.
#
# Usage:
#   NEON_API_KEY=...                  script/e2e-neon.sh
#   DATABASE_URL="postgresql://..."  script/e2e-neon.sh
#
# Env:
#   NEON_API_KEY   Neon API key (Bearer token). Required for mode A.
#   NEON_ORG_ID    Org id. Auto-detected from the key when omitted
#                  (personal keys need it, org-scoped keys don't).
#   DATABASE_URL   Existing Neon connection string (mode B).
#   NEON_REGION    Project region for mode A (default: aws-us-east-2).
#   NEON_PG        Postgres major version for mode A (default: 16).
#   KEEP_PROJECT=1 Keep the created project / tables after the test.
#   PACKAGE_DIR    Package under test (default: repo root — the current
#                  checkout, so CI tests exactly what was pushed).
# =====================================================================
set -euo pipefail

API_BASE="${API_BASE:-https://console.neon.tech/api/v2}"
NEON_REGION="${NEON_REGION:-aws-us-east-2}"
NEON_PG="${NEON_PG:-16}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_DIR="${PACKAGE_DIR:-$REPO_ROOT}"

PROJECT_ID=""
TMPDIR=""

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- preflight -------------------------------------------------------
command -v node >/dev/null || die "node is required"
command -v npm  >/dev/null || die "npm is required"
command -v curl >/dev/null || die "curl is required"
TMPDIR="$(mktemp -d)"

# --- JSON extraction helper (node, handles arrays: j.a[0].b) ---------
json_get() { # json_get <js-expr>  — reads JSON from stdin
  node -e '
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => {
      const j = JSON.parse(d);
      try {
        const v = eval(process.argv[1]);
        if (v === undefined) process.exit(1);
        console.log(typeof v === "object" ? JSON.stringify(v) : v);
      } catch { process.exit(1); }
    });
  ' "$1"
}

# --- Neon API helper (mode A) ----------------------------------------
api() { # api <method> <path> [json-body]
  local method="$1" path="$2" body="${3:-}"
  local out="$TMPDIR/api.out" code
  code="$(curl -sS -o "$out" -w '%{http_code}' -X "$method" \
    "$API_BASE$path" \
    -H "Authorization: Bearer $NEON_API_KEY" \
    -H 'Content-Type: application/json' \
    ${body:+-d "$body"})"
  [ "${code:0:1}" = "2" ] || die "API $method $path → HTTP $code: $(head -c 300 "$out")"
  cat "$out"
}

# --- cleanup (always runs) -------------------------------------------
cleanup() {
  if [ "$MODE" = "api" ] && [ -n "$PROJECT_ID" ] && [ "${KEEP_PROJECT:-0}" != "1" ]; then
    printf '  [cleanup] deleting test project %s…\n' "${PROJECT_ID:0:8}…"
    curl -sS -o /dev/null -X DELETE "$API_BASE/projects/$PROJECT_ID" \
      -H "Authorization: Bearer $NEON_API_KEY" || warn "failed to delete project"
  fi
  if [ "$MODE" = "byod" ] && [ -n "$DATABASE_URL" ] && [ "${KEEP_PROJECT:-0}" != "1" ]; then
    printf '  [cleanup] dropping test tables from your database…\n'
    (cd "$TMPDIR" && node --input-type=module -e '
      import { neon } from "@neondatabase/serverless";
      const sql = neon(process.env.DATABASE_URL);
      await sql`DROP TABLE IF EXISTS comments`;
      await sql`DROP TABLE IF EXISTS posts`;
      await sql`DROP TABLE IF EXISTS users`;
      await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    ') 2>/dev/null || warn "cleanup drop failed (leaving test tables)"
  fi
  [ -n "$TMPDIR" ] && rm -rf "$TMPDIR"
}
trap cleanup EXIT

# --- mode selection ----------------------------------------------------
MODE="api"
if [ -n "${DATABASE_URL:-}" ]; then
  MODE="byod"
  [ -n "${NEON_API_KEY:-}" ] && die "set either NEON_API_KEY (mode A) or DATABASE_URL (mode B), not both"
fi
if [ "$MODE" = "api" ] && [ -z "${NEON_API_KEY:-}" ]; then
  die "NEON_API_KEY is required (mode A). For mode B set DATABASE_URL instead."
fi

say "drizzle-migrate-neon-http — end-to-end test on Neon (mode: $MODE)"
echo "  package under test: $PACKAGE_DIR"

# --- mode A: create a dedicated project -------------------------------
if [ "$MODE" = "api" ]; then
  ORG_ID="${NEON_ORG_ID:-}"
  if [ -z "$ORG_ID" ]; then
    say "detecting org id…"
    ORG_ID="$(api GET /users/me/organizations | json_get 'j.organizations[0].id')" \
      || die "could not detect NEON_ORG_ID — set it explicitly"
  fi

  NAME="drizzle-migrate-e2e-$(date +%s)"
  say "creating project $NAME…"
  PROJECT_JSON="$(api POST /projects "{\"project\":{\"org_id\":\"$ORG_ID\",\"name\":\"$NAME\",\"pg_version\":$NEON_PG,\"region_id\":\"$NEON_REGION\"},\"branch\":{\"name\":\"main\"}}")"
  PROJECT_ID="$(echo "$PROJECT_JSON" | json_get 'j.project.id')"
  # The create response names the default role "role" on some auth paths
  # and "user" on others — accept both.
  CONN_PARAMS="$(echo "$PROJECT_JSON" | json_get 'j.connection_uris[0].connection_parameters')"
  HOST="$(echo "$CONN_PARAMS" | json_get 'j.host')"
  USER_="$(echo "$CONN_PARAMS" | json_get 'j.role || j.user')"
  PASS="$(echo "$CONN_PARAMS" | json_get 'j.password')"
  DBNAME="$(echo "$CONN_PARAMS" | json_get 'j.database')"
  [ -n "$PROJECT_ID" ] && [ -n "$HOST" ] && [ -n "$USER_" ] || die "could not parse project creation response"
  DATABASE_URL="postgresql://$USER_:$PASS@$HOST/$DBNAME?sslmode=require"
  export DATABASE_URL
  echo "  project ${PROJECT_ID:0:8}… ready (host ${HOST%%.*}…, db $DBNAME)"
fi

# --- workspace: install package + deps --------------------------------
# Install from the packed tarball (honors the "files" field) so the test
# exercises exactly what users get from npm — and it's independent of the
# checkout's own node_modules state.
say "setting up workspace…"
(
  cd "$TMPDIR"
  npm init -y >/dev/null 2>&1
  TARBALL="$(npm pack --silent "$PACKAGE_DIR" 2>/dev/null | tail -1)"
  [ -n "$TARBALL" ] || die "npm pack of $PACKAGE_DIR failed"
  npm i --silent "./$TARBALL" @neondatabase/serverless >/dev/null 2>&1
  npm i --silent -D drizzle-orm drizzle-kit >/dev/null 2>&1
) || die "npm install failed"

PKG_VERSION="$(node -p "require('$TMPDIR/node_modules/drizzle-migrate-neon-http/package.json').version")"
echo "  installed drizzle-migrate-neon-http v$PKG_VERSION"

# --- wait for the DB to accept connections (driver lives in TMPDIR) ----
say "waiting for the database…"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if (cd "$TMPDIR" && node --input-type=module -e '
      import { neon } from "@neondatabase/serverless";
      await neon(process.env.DATABASE_URL)`SELECT 1`;
    ') 2>/dev/null; then
    break
  fi
  [ "$i" = 10 ] && die "database did not become reachable"
  sleep 2
done
echo "  ok"

# --- generate migrations with drizzle-kit -----------------------------
say "generating migrations (drizzle-kit)…"
cat > "$TMPDIR/drizzle.config.ts" <<'EOF'
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  schema: './schema.ts',
  out: './drizzle',
});
EOF
cat > "$TMPDIR/schema.ts" <<'EOF'
import { pgTable, serial, text, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('users_email_idx').on(t.email)]);

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  body: text('body'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('posts_user_id_idx').on(t.userId)]);
EOF
(
  cd "$TMPDIR"
  npx drizzle-kit generate --config drizzle.config.ts >/dev/null 2>&1
)
# second migration: comments table
cat >> "$TMPDIR/schema.ts" <<'EOF'

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').notNull().references(() => posts.id),
  author: text('author').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('comments_post_id_idx').on(t.postId)]);
EOF
(
  cd "$TMPDIR"
  npx drizzle-kit generate --config drizzle.config.ts >/dev/null 2>&1
)
MIGRATIONS="$(ls "$TMPDIR"/drizzle/*.sql 2>/dev/null | wc -l)"
[ "$MIGRATIONS" = "2" ] || die "expected 2 migration files, got $MIGRATIONS"
echo "  $MIGRATIONS migration files generated"

# --- dry-run -----------------------------------------------------------
say "dry-run (must detect 2 pending migrations and touch nothing)…"
DRY="$(cd "$TMPDIR" && npx drizzle-migrate-neon-http --dir drizzle --dry-run 2>&1)"
echo "$DRY" | grep -q 'dry-run' || die "dry-run output missing"
echo "$DRY" | grep -q '0001_' || die "dry-run did not list the second migration"
TABLES_AFTER_DRY="$(cd "$TMPDIR" && node --input-type=module -e '
  import { neon } from "@neondatabase/serverless";
  const sql = neon(process.env.DATABASE_URL);
  const t = await sql`SELECT to_regclass('"'"'public.users'"'"') u, to_regclass('"'"'public.posts'"'"') p, to_regclass('"'"'public.comments'"'"') c`;
  console.log([t[0].u, t[0].p, t[0].c].filter(Boolean).join(","));
')"
[ -z "$TABLES_AFTER_DRY" ] || die "dry-run created tables: $TABLES_AFTER_DRY"
echo "  ok — no tables created"

# --- apply -------------------------------------------------------------
say "apply (must run both migrations)…"
OUT="$(cd "$TMPDIR" && npx drizzle-migrate-neon-http --dir drizzle 2>&1)"
echo "$OUT" | grep -q 'All migrations applied successfully' || { echo "$OUT" >&2; die "apply failed"; }
echo "$OUT" | grep -q '\[done\] 0001_' || die "second migration not applied"
N_MIG="$(cd "$TMPDIR" && node --input-type=module -e '
  import { neon } from "@neondatabase/serverless";
  const sql = neon(process.env.DATABASE_URL);
  const r = await sql`SELECT count(*)::int n FROM drizzle.__drizzle_migrations`;
  console.log(r[0].n);
')"
[ "$N_MIG" = "2" ] || die "expected 2 recorded migrations, got $N_MIG"
echo "  ok — 2 migrations applied and recorded"

# --- idempotency --------------------------------------------------------
say "re-run (must skip both as already applied)…"
OUT2="$(cd "$TMPDIR" && npx drizzle-migrate-neon-http --dir drizzle 2>&1)"
echo "$OUT2" | grep -q 'already applied' || die "re-run did not skip applied migrations"
echo "  ok — idempotent"

# --- data roundtrip + FK enforcement ------------------------------------
say "data roundtrip + FK enforcement…"
(cd "$TMPDIR" && node --input-type=module -e '
  import { neon } from "@neondatabase/serverless";
  const sql = neon(process.env.DATABASE_URL);
  const u = await sql`INSERT INTO users (name, email) VALUES ('"'"'E2E'"'"', '"'"'e2e@example.com'"'"') RETURNING id`;
  const p = await sql`INSERT INTO posts (user_id, title, body) VALUES (${u[0].id}, '"'"'hello'"'"', '"'"'world'"'"') RETURNING id`;
  await sql`INSERT INTO comments (post_id, author, content) VALUES (${p[0].id}, '"'"'E2E'"'"', '"'"'nice'"'"')`;
  const rows = await sql`SELECT u.name, p.title, c.content FROM users u JOIN posts p ON p.user_id = u.id JOIN comments c ON c.post_id = p.id`;
  if (rows.length !== 1 || rows[0].title !== "hello") throw new Error("roundtrip mismatch: " + JSON.stringify(rows));
  console.log("  ok — insert + join work");
  try {
    await sql`INSERT INTO posts (user_id, title) VALUES (999999, '"'"'nope'"'"')`;
    throw new Error("FK not enforced");
  } catch (e) {
    if (e.code !== "23503") throw e;
    console.log("  ok — FK violation blocked (23503)");
  }
') || die "data checks failed"

say "PASS — drizzle-migrate-neon-http v$PKG_VERSION works end-to-end on Neon"
echo "  (mode: $MODE — cleanup done via EXIT trap)"
