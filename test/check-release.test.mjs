import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTag, isCoherentBump } from "../script/check-release.mjs";

test("parseTag accepts vX.Y.Z", () => {
  assert.deepEqual(parseTag("v0.1.9"), [0, 1, 9]);
  assert.deepEqual(parseTag("v1.0.0"), [1, 0, 0]);
  assert.deepEqual(parseTag("v2.10.0"), [2, 10, 0]);
});

test("parseTag rejects malformed or non-plain tags", () => {
  assert.equal(parseTag("0.1.9"), null); // missing v prefix
  assert.equal(parseTag("v0.1"), null); // missing patch
  assert.equal(parseTag("v0.1.9-beta.1"), null); // pre-release
  assert.equal(parseTag("v0.1.9+build"), null); // build metadata
  assert.equal(parseTag("vfoo"), null);
  assert.equal(parseTag("v0.1.9.0"), null); // extra segment
});

test("isCoherentBump accepts exactly one increment", () => {
  assert.equal(isCoherentBump([0, 1, 8], [0, 1, 9]), true); // patch
  assert.equal(isCoherentBump([0, 1, 9], [0, 2, 0]), true); // minor
  assert.equal(isCoherentBump([0, 2, 0], [1, 0, 0]), true); // major (0.x -> 1.0)
  assert.equal(isCoherentBump([1, 0, 0], [1, 0, 1]), true);
  assert.equal(isCoherentBump([1, 0, 0], [1, 1, 0]), true);
  assert.equal(isCoherentBump([1, 0, 0], [2, 0, 0]), true);
});

test("isCoherentBump rejects downgrades, skips and mixed bumps", () => {
  assert.equal(isCoherentBump([0, 1, 9], [0, 1, 8]), false); // downgrade
  assert.equal(isCoherentBump([0, 1, 8], [0, 1, 8]), false); // duplicate
  assert.equal(isCoherentBump([0, 1, 8], [0, 1, 10]), false); // skipped patch
  assert.equal(isCoherentBump([0, 1, 8], [0, 3, 0]), false); // skipped minor
  assert.equal(isCoherentBump([0, 1, 8], [1, 1, 0]), false); // major+minor
  assert.equal(isCoherentBump([0, 1, 8], [0, 2, 1]), false); // minor+patch
});
