import assert from "node:assert/strict";
import test from "node:test";
import { validateProjectInput } from "../src/projects/validation.ts";

test("normalizes input and ignores a client-supplied owner", () => {
  const result = validateProjectInput({
    name: "  Study group  ",
    description: "  Weekly meetings  ",
    goal: "  Pass the course  ",
    targetDate: "2028-02-29",
    ownerId: "someone-else",
  });

  assert.deepEqual(result.data, {
    name: "Study group",
    description: "Weekly meetings",
    goal: "Pass the course",
    targetDate: new Date("2028-02-29T00:00:00.000Z"),
  });
});

test("accepts optional details and an omitted or empty target date", () => {
  for (const targetDate of [undefined, null, ""]) {
    assert.deepEqual(validateProjectInput({ name: "Project", targetDate }).data, {
      name: "Project",
      description: "",
      goal: "",
      targetDate: null,
    });
  }
});

test("rejects missing, blank, non-string and oversized fields", () => {
  for (const body of [
    undefined, null, [], "Project", {}, { name: 123 }, { name: "   " },
    { name: "x".repeat(101) },
    { name: "Project", description: {} },
    { name: "Project", description: "x".repeat(2001) },
    { name: "Project", goal: null },
    { name: "Project", goal: "x".repeat(2001) },
  ]) {
    assert.equal(typeof validateProjectInput(body).error, "string");
  }
});

test("rejects impossible dates, timestamps and non-string dates", () => {
  for (const targetDate of [
    "2027-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "0000-01-01",
    "2026-1-01", "2026-10-26T12:00:00Z", "not-a-date", 123, {},
  ]) {
    assert.equal(typeof validateProjectInput({ name: "Project", targetDate }).error, "string");
  }
});
