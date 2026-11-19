import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
const { app } = await import("../server.ts");
const { db } = await import("../src/prisma/db.ts");

const userId = "10000000-0000-0000-0000-000000000001";
const originalUpdate = db.user.update;
let storedUser;

beforeEach(() => {
  storedUser = { id: userId, name: "Nico", email: "nico@example.com", role: "user", attributes: {}, passwordHash: "secret" };
  db.user.update = mock.fn(async ({ where, data, select }) => {
    if (where.id !== userId) throw Object.assign(new Error("Record not found"), { code: "P2025" });
    Object.assign(storedUser, data);
    return Object.fromEntries(Object.keys(select).map((key) => [key, storedUser[key]]));
  });
});

afterEach(() => {
  db.user.update = originalUpdate;
});

async function request(body, sessionUserId = userId) {
  const route = app.router.stack.find((layer) => layer.route?.path === "/api/me" && layer.route.methods.patch).route;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  await route.stack[0].handle({ session: { userId: sessionUserId }, body }, response);
  return response;
}

test("changing your name requires authentication", async () => {
  assert.equal((await request({ name: "New" }, null)).statusCode, 401);
  assert.equal(db.user.update.mock.callCount(), 0);
});

test("a user can change their name, trimmed, without exposing the password hash", async () => {
  const response = await request({ name: "  Nicolas  " });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.name, "Nicolas");
  assert.equal(response.body.user.passwordHash, undefined);
  assert.equal(storedUser.name, "Nicolas");
});

test("only the name can change, even if other fields are sent", async () => {
  await request({ name: "Nicolas", email: "other@example.com", role: "admin", id: "someone-else" });
  const args = db.user.update.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, { id: userId });
  assert.deepEqual(args.data, { name: "Nicolas" });
  assert.equal(storedUser.role, "user");
  assert.equal(storedUser.email, "nico@example.com");
});

test("blank, missing, non-string, and overly long names are rejected", async () => {
  for (const body of [{}, { name: "" }, { name: "   " }, { name: 123 }, { name: "x".repeat(101) }, null]) {
    assert.equal((await request(body)).statusCode, 400);
  }
  assert.equal(db.user.update.mock.callCount(), 0);
  assert.equal(storedUser.name, "Nico");
});

test("name update failures do not expose database details", async (context) => {
  context.mock.method(console, "error", () => {});
  db.user.update = mock.fn(async () => { throw new Error("private database details"); });
  const response = await request({ name: "Nicolas" });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Unable to update name" });
});
