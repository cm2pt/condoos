import test from "node:test";
import assert from "node:assert/strict";
import { can, getUiCapability } from "../rbac.js";

test("manager can read audit logs", () => {
  assert.equal(can("manager", "audit", "read"), true);
});

test("resident cannot read audit logs", () => {
  assert.equal(can("resident", "audit", "read"), false);
});

test("resident can read scoped fractions", () => {
  assert.equal(can("resident", "fractions", "read"), true);
});

test("resident can read documents in allowed visibility scope", () => {
  assert.equal(can("resident", "documents", "read"), true);
});

test("manager can create document versions", () => {
  assert.equal(can("manager", "documents", "create"), true);
  assert.equal(can("manager", "documents", "update"), true);
});

test("resident cannot create documents", () => {
  assert.equal(can("resident", "documents", "create"), false);
});

test("operations can update issues", () => {
  assert.equal(can("operations", "issues", "update"), true);
});

test("manager can manage people", () => {
  assert.equal(can("manager", "people", "create"), true);
  assert.equal(can("manager", "people", "delete"), true);
});

test("resident cannot create people records", () => {
  assert.equal(can("resident", "people", "create"), false);
});

test("unknown role has no permissions", () => {
  assert.equal(can("unknown", "finance", "read"), false);
});

test("manager ui capability contains finance module and quick action", () => {
  const capability = getUiCapability("manager");
  assert.equal(capability.modules.includes("finance"), true);
  assert.equal(capability.quickActions.includes("finance"), true);
});

test("unknown role has empty ui capability", () => {
  const capability = getUiCapability("unknown");
  assert.deepEqual(capability, { modules: [], quickActions: [] });
});
