import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
const { app } = await import("../server.ts");
const { db } = await import("../src/prisma/db.ts");

const uuid = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const [a, b, c, d, e, f, g] = Array.from({ length: 7 }, (_, index) => uuid(index + 1));
const listPath = "/api/friends";
const sendPath = "/api/friends/requests";
const respondPath = "/api/friends/requests/:id/:action";
const removePath = "/api/friends/:id";
let users;
let records;
const originals = {
  userFind: db.user.findUnique, userDelete: db.user.delete, collaboratorDelete: db.projectCollaborator.deleteMany,
  findMany: db.friendRequest.findMany, create: db.friendRequest.create, update: db.friendRequest.update,
  updateMany: db.friendRequest.updateMany, deleteMany: db.friendRequest.deleteMany, transaction: db.$transaction,
};

const record = (id, senderId, receiverId, status, date) => ({ id: uuid(id), senderId, receiverId, status, createdAt: new Date(date), attributes: {} });
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((clause) => matches(row, clause));
    if (value && typeof value === "object" && "in" in value) return value.in.includes(row[key]);
    return typeof row[key] === "string" && key.endsWith("Id")
      ? row[key].toLowerCase() === value.toLowerCase() : row[key] === value;
  });
}

beforeEach(() => {
  users = Array.from({ length: 10 }, (_, index) => ({ id: uuid(index + 1), name: `Person ${index + 1}`, email: `person${index + 1}@example.com`, passwordHash: "private-hash", attributes: { private: true } }));
  records = [
    record(101, a, b, "accepted", "2026-11-01"),
    record(102, c, a, "accepted", "2026-11-10"),
    record(103, d, a, "pending", "2026-11-12"),
    record(104, a, e, "pending", "2026-11-13"),
    record(105, b, f, "accepted", "2026-11-20"),
    record(106, a, f, "declined", "2026-10-01"),
  ];
  db.user.findUnique = mock.fn(async ({ where }) => users.find((user) => user.email === where.email) ?? null);
  db.user.delete = mock.fn(async () => { throw new Error("Friends must not delete users"); });
  db.projectCollaborator.deleteMany = mock.fn(async () => { throw new Error("Friends must not change collaborators"); });
  db.friendRequest.findMany = mock.fn(async ({ where, orderBy = [], include }) => {
    const rows = records.filter((row) => matches(row, where)).sort((left, right) => {
      for (const clause of Array.isArray(orderBy) ? orderBy : [orderBy]) {
        for (const [key, direction] of Object.entries(clause)) {
          const compared = left[key] < right[key] ? -1 : left[key] > right[key] ? 1 : 0;
          if (compared) return direction === "desc" ? -compared : compared;
        }
      }
      return 0;
    });
    return rows.map((row) => include ? { ...row, sender: users.find((user) => user.id === row.senderId), receiver: users.find((user) => user.id === row.receiverId) } : { ...row });
  });
  db.friendRequest.create = mock.fn(async ({ data }) => {
    const created = { ...record(200 + records.length, data.senderId, data.receiverId, "pending", "2026-11-21"), ...data };
    records.push(created);
    return created;
  });
  db.friendRequest.update = mock.fn(async ({ where, data }) => {
    const found = records.find((row) => row.id === where.id);
    if (!found) throw Object.assign(new Error("Missing"), { code: "P2025" });
    return Object.assign(found, data);
  });
  db.friendRequest.updateMany = mock.fn(async ({ where, data }) => {
    const rows = records.filter((row) => matches(row, where));
    rows.forEach((row) => Object.assign(row, data));
    return { count: rows.length };
  });
  db.friendRequest.deleteMany = mock.fn(async ({ where }) => {
    const before = records.length;
    records = records.filter((row) => !matches(row, where));
    return { count: before - records.length };
  });
  db.$transaction = mock.fn(async (callback, options) => {
    assert.deepEqual(options, { isolationLevel: "Serializable" });
    return callback(db);
  });
});

afterEach(() => {
  db.user.findUnique = originals.userFind;
  db.user.delete = originals.userDelete;
  db.projectCollaborator.deleteMany = originals.collaboratorDelete;
  db.friendRequest.findMany = originals.findMany;
  db.friendRequest.create = originals.create;
  db.friendRequest.update = originals.update;
  db.friendRequest.updateMany = originals.updateMany;
  db.friendRequest.deleteMany = originals.deleteMany;
  db.$transaction = originals.transaction;
});

async function request(method, path, { userId = a, body = {}, params = {} } = {}) {
  const route = app.router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  await route.stack[0].handle({ session: { userId }, body, params }, response);
  return response;
}
const remove = (id = b, options = {}) => request("delete", removePath, { params: { id }, ...options });
const send = (email = "person7@example.com", options = {}) => request("post", sendPath, { body: { email }, ...options });
const respond = (id = uuid(103), action = "accept", options = {}) => request("post", respondPath, { params: { id, action }, ...options });

test("all friends routes reject unauthenticated users before database access", async () => {
  for (const [method, path] of [["get", listPath], ["post", sendPath], ["post", respondPath], ["delete", removePath]]) {
    assert.equal((await request(method, path, { userId: null })).statusCode, 401);
  }
  assert.equal(db.friendRequest.findMany.mock.callCount(), 0);
  assert.equal(db.friendRequest.updateMany.mock.callCount(), 0);
  assert.equal(db.friendRequest.deleteMany.mock.callCount(), 0);
  assert.equal(db.user.findUnique.mock.callCount(), 0);
});

test("friends list retains the compatible friends/incoming/outgoing response with safe user fields", async () => {
  const response = await request("get", listPath);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ["friends", "incoming", "outgoing"]);
  assert.deepEqual(response.body.friends.map((friend) => friend.id), [c, b]);
  assert.equal(response.body.incoming[0].user.id, d);
  assert.equal(response.body.outgoing[0].user.id, e);
  for (const friend of [...response.body.friends, ...response.body.incoming.map((row) => row.user), ...response.body.outgoing.map((row) => row.user)]) {
    assert.deepEqual(Object.keys(friend).sort(), ["email", "id", "name"]);
  }
  assert.equal(JSON.stringify(response.body).includes("private"), false);
});

test("friends list orders newest first with descending ID as a deterministic timestamp tie breaker", async () => {
  records.push(record(110, a, g, "accepted", "2026-11-10"));
  const response = await request("get", listPath);
  assert.deepEqual(response.body.friends.map((friend) => friend.id), [g, c, b]);
  assert.deepEqual(db.friendRequest.findMany.mock.calls[0].arguments[0].orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
});

test("the API still returns all friends for the full page and existing collaborator consumers", async () => {
  records = Array.from({ length: 7 }, (_, index) => record(110 + index, a, uuid(index + 2), "accepted", `2026-11-${String(index + 1).padStart(2, "0")}`));
  const response = await request("get", listPath);
  assert.equal(response.body.friends.length, 7);
  assert.deepEqual(response.body.friends.map((friend) => friend.id), [uuid(8), uuid(7), uuid(6), uuid(5), uuid(4), uuid(3), uuid(2)]);
});

test("a sender can remove their accepted friend without deleting users or collaborator records", async () => {
  const beforeUsers = structuredClone(users);
  const response = await remove();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { message: "Friend removed" });
  assert.equal(records.some((row) => row.id === uuid(101)), false);
  assert.deepEqual(users, beforeUsers);
  assert.equal(db.user.delete.mock.callCount(), 0);
  assert.equal(db.projectCollaborator.deleteMany.mock.callCount(), 0);
});

test("a receiver can remove a friendship in the opposite direction", async () => {
  assert.equal((await remove(c)).statusCode, 200);
  assert.equal(records.some((row) => row.id === uuid(102)), false);
});

test("removal disappears from both users' friend lists", async () => {
  assert.equal((await remove()).statusCode, 200);
  assert.equal((await request("get", listPath)).body.friends.some((friend) => friend.id === b), false);
  assert.equal((await request("get", listPath, { userId: b })).body.friends.some((friend) => friend.id === a), false);
});

test("a user cannot remove a friendship between unrelated users", async () => {
  const before = structuredClone(records);
  assert.equal((await remove(f)).statusCode, 404);
  assert.deepEqual(records, before);
  assert.ok(records.some((row) => row.id === uuid(105)));
});

test("unfriending never removes pending or declined requests", async () => {
  const before = structuredClone(records);
  for (const id of [d, e, f]) assert.equal((await remove(id)).statusCode, 404);
  assert.deepEqual(records, before);
});

test("missing, repeated, and malformed friend removals return safe not-found responses", async () => {
  assert.equal((await remove()).statusCode, 200);
  for (const id of [b, g, "invalid", "", "../../user"]) {
    const response = await remove(id);
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { message: "Friendship not found" });
  }
});

test("malformed friend IDs are rejected before attempting deletion", async () => {
  assert.equal((await remove("not-a-uuid")).statusCode, 404);
  assert.equal(db.friendRequest.deleteMany.mock.callCount(), 0);
});

test("friend removal database failures return a safe response", async (context) => {
  context.mock.method(console, "error", () => {});
  db.friendRequest.deleteMany = mock.fn(async () => { throw new Error("private SQL details"); });
  const response = await remove();
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Unable to remove friend" });
});

test("sending a request normalizes email and preserves the existing success response", async () => {
  const response = await send("  PERSON7@example.com  ");
  assert.equal(response.statusCode, 201);
  assert.equal(db.user.findUnique.mock.calls[0].arguments[0].where.email, "person7@example.com");
  assert.equal(records.filter((row) => row.senderId === a && row.receiverId === g).length, 1);
});

test("self friend requests are rejected", async () => {
  assert.equal((await send("person1@example.com")).statusCode, 400);
  assert.equal(db.$transaction.mock.callCount(), 0);
  assert.equal(db.friendRequest.create.mock.callCount(), 0);
});

test("malformed friend request bodies and email values are rejected safely", async () => {
  for (const body of [undefined, null, [], "email", {}, { email: null }, { email: 123 }, { email: " " }, { email: "invalid" }, { email: "a@@b.com" }, { email: "a b@example.com" }, { email: "x".repeat(255) + "@example.com" }]) {
    assert.equal((await request("post", sendPath, { body })).statusCode, 400);
  }
  assert.equal(db.user.findUnique.mock.callCount(), 0);
});

test("an unknown recipient returns a safe not-found response", async () => {
  const response = await send("missing@example.com");
  assert.equal(response.statusCode, 404);
  assert.equal(db.friendRequest.create.mock.callCount(), 0);
});

test("accepted friends in either direction cannot create duplicate friendships", async () => {
  for (const email of ["person2@example.com", "person3@example.com"]) assert.equal((await send(email)).statusCode, 409);
  assert.equal(db.friendRequest.create.mock.callCount(), 0);
  assert.equal(db.friendRequest.update.mock.callCount(), 0);
});

test("duplicate outgoing pending requests are rejected without creating another record", async () => {
  assert.equal((await send("person5@example.com")).statusCode, 409);
  assert.equal(db.friendRequest.create.mock.callCount(), 0);
});

test("a reversed pending request accepts the existing request rather than adding a second friendship", async () => {
  const before = records.length;
  assert.equal((await send("person4@example.com")).statusCode, 200);
  assert.equal(records.find((row) => row.id === uuid(103)).status, "accepted");
  assert.equal(records.length, before);
  assert.equal(db.friendRequest.create.mock.callCount(), 0);
});

test("active relationships take precedence over an old declined reverse request", async () => {
  records.push(record(120, d, a, "declined", "2026-11-20"));
  assert.equal((await send("person4@example.com")).statusCode, 200);
  assert.equal(records.find((row) => row.id === uuid(103)).status, "accepted");
  assert.equal(records.find((row) => row.id === uuid(120)).status, "declined");
  assert.equal(db.friendRequest.create.mock.callCount(), 0);
});

test("a declined request can be sent again using its existing record", async () => {
  const before = records.length;
  assert.equal((await send("person6@example.com")).statusCode, 201);
  const resent = records.find((row) => row.id === uuid(106));
  assert.equal(resent.status, "pending");
  assert.equal(resent.senderId, a);
  assert.equal(resent.receiverId, f);
  assert.equal(records.length, before);
});

test("serialization conflicts retry and recognize a concurrently committed reversed request", async () => {
  let attempts = 0;
  db.$transaction = mock.fn(async (callback, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    if (attempts++ === 0) {
      records.push(record(130, g, a, "pending", "2026-11-21"));
      throw Object.assign(new Error("Concurrent transaction"), { code: "P2034" });
    }
    return callback(db);
  });
  assert.equal((await send()).statusCode, 200);
  assert.equal(db.$transaction.mock.callCount(), 2);
  assert.equal(records.filter((row) => [row.senderId, row.receiverId].includes(g) && [row.senderId, row.receiverId].includes(a)).length, 1);
  assert.equal(records.find((row) => row.id === uuid(130)).status, "accepted");
});

test("a concurrent unique conflict retries without creating a duplicate pending request", async () => {
  let attempts = 0;
  db.$transaction = mock.fn(async (callback) => {
    if (attempts++ === 0) {
      records.push(record(130, a, g, "pending", "2026-11-21"));
      throw Object.assign(new Error("Unique conflict"), { code: "P2002" });
    }
    return callback(db);
  });
  assert.equal((await send()).statusCode, 409);
  assert.equal(db.friendRequest.create.mock.callCount(), 0);
});

test("repeated transaction conflicts stop after three attempts with a safe error", async (context) => {
  context.mock.method(console, "error", () => {});
  db.$transaction = mock.fn(async () => { throw Object.assign(new Error("private transaction details"), { code: "P2034" }); });
  const response = await send();
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Unable to send friend request" });
  assert.equal(db.$transaction.mock.callCount(), 3);
});

test("only the recipient can accept or decline their pending request", async () => {
  for (const action of ["accept", "decline"]) {
    assert.equal((await respond(uuid(104), action)).statusCode, 404);
    assert.equal((await respond(uuid(103), action, { userId: b })).statusCode, 404);
  }
  assert.equal(records.find((row) => row.id === uuid(104)).status, "pending");
});

test("accepting a pending request updates the existing friendship and friends response", async () => {
  assert.equal((await respond()).statusCode, 200);
  assert.equal(records.find((row) => row.id === uuid(103)).status, "accepted");
  const list = await request("get", listPath);
  assert.equal(list.body.friends[0].id, d);
  assert.equal(list.body.incoming.length, 0);
});

test("declining a pending request preserves the record but does not add a friend", async () => {
  const response = await respond(uuid(103), "decline");
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, "Friend request declined");
  assert.equal(records.find((row) => row.id === uuid(103)).status, "declined");
  const list = await request("get", listPath);
  assert.equal(list.body.incoming.length, 0);
  assert.equal(list.body.friends.some((friend) => friend.id === d), false);
});

test("invalid request IDs/actions and already handled requests cannot be changed", async () => {
  for (const id of ["invalid", "", uuid(999), uuid(101), uuid(106)]) {
    assert.equal((await respond(id)).statusCode, 404);
  }
  assert.equal((await respond(uuid(103), "invalid")).statusCode, 400);
  assert.equal((await respond()).statusCode, 200);
  assert.equal((await respond(uuid(103), "decline")).statusCode, 404);
});

test("list, send, and response database failures expose only safe messages", async (context) => {
  context.mock.method(console, "error", () => {});
  db.friendRequest.findMany = mock.fn(async () => { throw new Error("private SQL details"); });
  const list = await request("get", listPath);
  assert.equal(list.statusCode, 500);
  assert.deepEqual(list.body, { message: "Unable to load friends" });
  const sent = await send();
  assert.equal(sent.statusCode, 500);
  assert.deepEqual(sent.body, { message: "Unable to send friend request" });
  db.friendRequest.updateMany = mock.fn(async () => { throw new Error("private SQL details"); });
  const responded = await respond();
  assert.equal(responded.statusCode, 500);
  assert.deepEqual(responded.body, { message: "Unable to update friend request" });
});
