import { test } from "node:test";
import assert from "node:assert/strict";
import { splitStatements } from "../src/split-statements.mjs";

test("splits simple multi-statement SQL", () => {
  const out = splitStatements("CREATE TABLE a (id int); CREATE TABLE b (id int);");
  assert.equal(out.length, 2);
  assert.ok(out[0].startsWith("CREATE TABLE a"));
  assert.ok(out[1].startsWith("CREATE TABLE b"));
});

test("does not split on semicolons inside single-quoted strings", () => {
  const sql = `INSERT INTO t (v) VALUES ('hello; world'); SELECT 1;`;
  const out = splitStatements(sql);
  assert.equal(out.length, 2);
  assert.match(out[0], /'hello; world'/);
});

test("handles escaped quotes and keeps string content", () => {
  const sql = `INSERT INTO t (v) VALUES ('it\\'s fine'); SELECT 2;`;
  const out = splitStatements(sql);
  assert.equal(out.length, 2);
  assert.ok(out[0].includes("it\\'s fine"));
});

test("drops comment-only and empty chunks", () => {
  const sql = `-- comment line\n;\nSELECT 1;   \n-- trailing`;
  const out = splitStatements(sql);
  assert.deepEqual(out, ["SELECT 1"]);
});

test("strips line comments before splitting", () => {
  const sql = `SELECT 1; -- explain\nSELECT 2;`;
  const out = splitStatements(sql);
  assert.deepEqual(out, ["SELECT 1", "SELECT 2"]);
});

test("returns single statement without trailing semicolon handling issues", () => {
  const out = splitStatements("SELECT 1");
  assert.deepEqual(out, ["SELECT 1"]);
});

test("returns empty array for whitespace only", () => {
  const out = splitStatements("   \n  ");
  assert.deepEqual(out, []);
});