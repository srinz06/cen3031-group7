import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
const { app } = await import("../server.ts");
const { db } = await import("../src/prisma/db.ts");

const ownerId = "10000000-0000-0000-0000-000000000001";
const friendId = "10000000-0000-0000-0000-000000000002";
const strangerId = "10000000-0000-0000-0000-000000000003";
const secondFriendId = "10000000-0000-0000-0000-000000000004";
const projectId = "20000000-0000-0000-0000-000000000001";
const users = {
  [ownerId]: { id: ownerId, name: "Owner", email: "owner@example.com" },
  [friendId]: { id: friendId, name: "Friend", email: "friend@example.com" },
  [strangerId]: { id: strangerId, name: "Stranger", email: "stranger@example.com" },
  [secondFriendId]: { id: secondFriendId, name: "Second", email: "second@example.com" },
};
const originalMethods = {
  projectFindFirst: db.project.findFirst,
  friendFindFirst: db.friendRequest.findFirst,
  create: db.projectCollaborator.create,
  deleteMany: db.projectCollaborator.deleteMany,
};
let collaborators;
let friendships;

const canAccess = (where) => where.ownerId !== undefined
  ? where.ownerId === ownerId
  : where.OR.some((clause) => clause.ownerId === ownerId ||
    collaborators.includes(clause.collaborators?.some.userId));

beforeEach(() => {
  collaborators = [];
  friendships = [[ownerId, friendId], [secondFriendId, ownerId]];
  db.project.findFirst = mock.fn(async ({ where, select }) => {
    if (where.id !== projectId || !canAccess(where)) return null;
    const project = {
      id: projectId, name: "Study group", description: "", goal: "", targetDate: null, ownerId,
      owner: users[ownerId],
      collaborators: collaborators.map((id) => ({ user: users[id] })),
    };
    return Object.fromEntries(Object.keys(select).map((key) => [key, project[key]]));
  });
  db.friendRequest.findFirst = mock.fn(async ({ where }) => {
    const match = where.OR.some(({ senderId, receiverId }) =>
      friendships.some(([a, b]) => a === senderId && b === receiverId));
    return where.status === "accepted" && match ? { id: "friendship" } : null;
  });
  db.projectCollaborator.create = mock.fn(async ({ data }) => {
    if (collaborators.includes(data.userId)) throw Object.assign(new Error("Unique"), { code: "P2002" });
    collaborators.push(data.userId);
    return { user: users[data.userId] };
  });
  db.projectCollaborator.deleteMany = mock.fn(async ({ where }) => {
    const before = collaborators.length;
    collaborators = collaborators.filter((id) => !(where.projectId === projectId && id === where.userId));
    return { count: before - collaborators.length };
  });
});

afterEach(() => {
  db.project.findFirst = originalMethods.projectFindFirst;
  db.friendRequest.findFirst = originalMethods.friendFindFirst;
  db.projectCollaborator.create = originalMethods.create;
  db.projectCollaborator.deleteMany = originalMethods.deleteMany;
});

async function request(method, path, { userId = ownerId, body = {}, params = {} } = {}) {
  const route = app.router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  await route.stack[0].handle({ session: { userId }, body, params }, response);
  return response;
}

const add = (userId, options = {}) => request("post", "/api/projects/:id/collaborators", {
  params: { id: projectId }, body: { userId }, ...options,
});
const remove = (userId, options = {}) => request("delete", "/api/projects/:id/collaborators/:userId", {
  params: { id: projectId, userId }, ...options,
});

test("collaborator routes reject unauthenticated users before querying the database", async () => {
  assert.equal((await add(friendId, { userId: null })).statusCode, 401);
  assert.equal((await remove(friendId, { userId: null })).statusCode, 401);
  assert.equal(db.project.findFirst.mock.callCount(), 0);
});

test("the owner can add an accepted friend in either request direction", async () => {
  const first = await add(friendId);
  assert.equal(first.statusCode, 201);
  assert.deepEqual(first.body.collaborator, users[friendId]);
  assert.equal((await add(secondFriendId)).statusCode, 201);
  assert.deepEqual(collaborators, [friendId, secondFriendId]);
});

test("only friends can be added, and the owner cannot add themselves", async () => {
  assert.equal((await add(strangerId)).statusCode, 400);
  assert.equal((await add(ownerId)).statusCode, 400);
  assert.equal(db.projectCollaborator.create.mock.callCount(), 0);
});

test("adding a friend twice returns a conflict", async () => {
  await add(friendId);
  const response = await add(friendId);
  assert.equal(response.statusCode, 409);
  assert.deepEqual(collaborators, [friendId]);
});

test("adding requires a valid user ID and project ID", async () => {
  for (const userId of [undefined, "", "bad", 123]) {
    assert.equal((await add(userId)).statusCode, 400);
  }
  assert.equal((await request("post", "/api/projects/:id/collaborators", {
    params: { id: "bad" }, body: { userId: friendId },
  })).statusCode, 404);
  assert.equal(db.projectCollaborator.create.mock.callCount(), 0);
});

test("a collaborator cannot add other people to the project", async () => {
  collaborators = [friendId];
  const response = await add(secondFriendId, { userId: friendId });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(collaborators, [friendId]);
});

test("a collaborator sees the project with its owner and members, but not as owner", async () => {
  collaborators = [friendId];
  const response = await request("get", "/api/projects/:id", { userId: friendId, params: { id: projectId } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.isOwner, false);
  assert.equal(response.body.viewerId, friendId);
  assert.deepEqual(response.body.owner, users[ownerId]);
  assert.deepEqual(response.body.collaborators, [users[friendId]]);
  assert.equal(response.body.project.ownerId, undefined);
});

test("a removed or never-added user cannot open the project", async () => {
  assert.equal((await request("get", "/api/projects/:id", { userId: strangerId, params: { id: projectId } })).statusCode, 404);
});

test("the owner can remove a collaborator", async () => {
  collaborators = [friendId, secondFriendId];
  const response = await remove(friendId);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(collaborators, [secondFriendId]);
});

test("a collaborator can leave, but cannot remove someone else", async () => {
  collaborators = [friendId, secondFriendId];
  assert.equal((await remove(secondFriendId, { userId: friendId })).statusCode, 404);
  assert.deepEqual(collaborators, [friendId, secondFriendId]);
  const left = await remove(friendId, { userId: friendId });
  assert.equal(left.statusCode, 200);
  assert.deepEqual(left.body, { message: "You left the project" });
  assert.deepEqual(collaborators, [secondFriendId]);
});

test("removing someone who is not a collaborator, or from a project you can't see, is not found", async () => {
  assert.equal((await remove(strangerId)).statusCode, 404);
  assert.equal((await remove(friendId, { userId: strangerId })).statusCode, 404);
  assert.equal((await remove("bad")).statusCode, 404);
});

test("collaborator failures do not expose database details", async (context) => {
  context.mock.method(console, "error", () => {});
  db.projectCollaborator.create = mock.fn(async () => { throw new Error("private database details"); });
  const response = await add(friendId);
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Unable to add collaborator" });
});
