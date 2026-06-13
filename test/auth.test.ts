/**
 * test/auth.test.ts — the optional server lock.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorized, bearerToken } from "../src/auth";

test("open when no token is configured", () => {
  assert.equal(isAuthorized(undefined, undefined, undefined), true);
  assert.equal(isAuthorized("Bearer anything", undefined, ""), true);
});

test("locked: rejects missing or wrong tokens", () => {
  assert.equal(isAuthorized(undefined, undefined, "s3cret"), false);
  assert.equal(isAuthorized("Bearer wrong", undefined, "s3cret"), false);
  assert.equal(isAuthorized(undefined, "wrong", "s3cret"), false);
});

test("locked: accepts a correct bearer header or ?token=", () => {
  assert.equal(isAuthorized("Bearer s3cret", undefined, "s3cret"), true);
  assert.equal(isAuthorized(undefined, "s3cret", "s3cret"), true);
});

test("bearerToken parses only well-formed headers", () => {
  assert.equal(bearerToken("Bearer abc"), "abc");
  assert.equal(bearerToken("Basic abc"), undefined);
  assert.equal(bearerToken(undefined), undefined);
  assert.equal(bearerToken("Bearer "), undefined);
});
