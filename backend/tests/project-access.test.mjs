import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
const { app } = await import("../server.ts");
const { db } = await import("../src/prisma/db.ts");

const ownerId = "10000000-0000-0000-0000-000000000001";
const otherId = "10000000-0000-0000-0000-000000000002";
const projectId = "20000000-0000-0000-0000-000000000001";
const otherProjectId = "20000000-0000-0000-0000-000000000002";
const missingId = "20000000-0000-0000-0000-000000000003";
const originalFindFirst = db.project.findFirst;
const originalUpdate = db.project.update;
const originalDelete = db.project.delete;
let storedProjects;
const project = {
  id: projectId, ownerId, name: "Study group", description: "Weekly study sessions",
  goal: "Pass the course", targetDate: new Date("2026-12-01"), attributes: { private: true },
};

beforeEach(() => {
  storedProjects = [structuredClone(project), { ...structuredClone(project), id: otherProjectId, ownerId: otherId }];
  db.project.delete = mock.fn(async ({ where }) => {
    const index = storedProjects.findIndex((candidate) => candidate.id === where.id && candidate.ownerId === where.ownerId);
    if (index === -1) throw Object.assign(new Error("Record not found"), { code: "P2025" });
    return storedProjects.splice(index, 1)[0];
  });
  db.project.findFirst = mock.fn(async ({ where, select }) => {
    const found = storedProjects.find((candidate) => candidate.id === where.id && (where.ownerId !== undefined
      ? candidate.ownerId === where.ownerId
      : where.OR.some((clause) => clause.ownerId === candidate.ownerId)));
    if (!found) return null;
    const related = { owner: { id: found.ownerId, name: "Owner", email: "owner@example.com" }, collaborators: [] };
    return Object.fromEntries(Object.keys(select).map((key) => [key, key in related ? related[key] : found[key]]));
  });
  db.project.update = mock.fn(async ({ where, data, select }) => {
    const found = storedProjects.find((candidate) => candidate.id === where.id && candidate.ownerId === where.ownerId);
    if (!found) throw Object.assign(new Error("Record not found"), { code: "P2025" });
    Object.assign(found, data);
    return Object.fromEntries(Object.keys(select).map((key) => [key, found[key]]));
  });
});

afterEach(() => {
  db.project.findFirst = originalFindFirst;
  db.project.update = originalUpdate;
  db.project.delete = originalDelete;
});

async function request(id = projectId, userId = ownerId, method = "get", body = {}) {
  const route = app.router.stack.find((layer) => layer.route?.path === "/api/projects/:id" && layer.route.methods[method]).route;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
  };
  await route.stack[0].handle({ session: { userId }, params: { id }, body }, response);
  return response;
}

test("project details require authentication before querying the database", async () => {
  assert.equal((await request(projectId, null)).statusCode, 401);
  assert.equal(db.project.findFirst.mock.callCount(), 0);
});

test("project details reject malformed UUIDs without querying the database", async () => {
  for (const id of ["invalid", "", "123", "../../other-project"]) {
    const response = await request(id);
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { message: "Project not found" });
  }
  assert.equal(db.project.findFirst.mock.callCount(), 0);
});

test("project details query by project ID and owner or collaborator access", async () => {
  const response = await request();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(db.project.findFirst.mock.calls[0].arguments[0].where, {
    id: projectId,
    OR: [{ ownerId }, { collaborators: { some: { userId: ownerId } } }],
  });
  assert.equal(response.body.isOwner, true);
  assert.deepEqual(response.body.collaborators, []);
  assert.deepEqual(response.body.project, {
    id: project.id, name: project.name, description: project.description,
    goal: project.goal, targetDate: project.targetDate,
  });
});

test("another user's project and a missing project have the same safe response", async () => {
  const foreign = await request(otherProjectId);
  const missing = await request(missingId);
  assert.equal(foreign.statusCode, 404);
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(foreign.body, missing.body);
  assert.deepEqual(foreign.body, { message: "Project not found" });
});

test("changing the session user cannot reveal a project owned by someone else", async () => {
  const response = await request(projectId, otherId);
  assert.equal(response.statusCode, 404);
  assert.equal(response.body.project, undefined);
});

test("project database errors return a safe failure message", async (context) => {
  context.mock.method(console, "error", () => {});
  db.project.findFirst = mock.fn(async () => { throw new Error("private database details"); });
  const response = await request();
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Unable to load project" });
});

test("project edits reject unauthenticated users and malformed UUIDs before writing", async () => {
  assert.equal((await request(projectId, null, "put", { name: "Updated" })).statusCode, 401);
  for (const id of ["invalid", "", "123", "../../other-project"]) {
    assert.equal((await request(id, ownerId, "put", { name: "Updated" })).statusCode, 404);
  }
  assert.equal(db.project.update.mock.callCount(), 0);
});

test("project edits reject another user's project and nonexistent projects with the same response", async () => {
  const before = structuredClone(storedProjects);
  const foreign = await request(otherProjectId, ownerId, "put", { name: "Updated" });
  const missing = await request(missingId, ownerId, "put", { name: "Updated" });
  assert.equal(foreign.statusCode, 404);
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(foreign.body, { message: "Project not found" });
  assert.deepEqual(foreign.body, missing.body);
  assert.deepEqual(storedProjects, before);
});

test("an owner can update all project details without changing identity, ownership, or attributes", async () => {
  const response = await request(projectId, ownerId, "put", {
    name: "  New name  ", description: "  New description  ", goal: "  New goal  ", targetDate: "2028-02-29",
    ownerId: otherId, id: otherProjectId, attributes: {}, tasks: { deleteMany: {} },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.project, {
    id: projectId, name: "New name", description: "New description", goal: "New goal", targetDate: new Date("2028-02-29"),
  });
  const args = db.project.update.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, { id: projectId, ownerId });
  assert.deepEqual(Object.keys(args.data).sort(), ["description", "goal", "name", "targetDate"]);
  assert.equal(storedProjects[0].ownerId, ownerId);
  assert.equal(storedProjects[0].id, projectId);
  assert.deepEqual(storedProjects[0].attributes, project.attributes);
  assert.equal(storedProjects[1].name, project.name);
});

test("optional project details and the target date can be cleared", async () => {
  const response = await request(projectId, ownerId, "put", {
    name: "Study group", description: "", goal: "", targetDate: null,
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.project.description, "");
  assert.equal(response.body.project.goal, "");
  assert.equal(response.body.project.targetDate, null);
});

test("project creation validation limits also apply to edits", async () => {
  const before = structuredClone(storedProjects);
  for (const body of [null, [], {}, { name: " " }, { name: 123 }, { name: "x".repeat(101) },
    { name: "Project", description: "x".repeat(2001) }, { name: "Project", description: {} },
    { name: "Project", goal: "x".repeat(2001) }, { name: "Project", goal: {} },
    { name: "Project", targetDate: "2026-02-30" }, { name: "Project", targetDate: "2026-12-01T12:00:00Z" }]) {
    assert.equal((await request(projectId, ownerId, "put", body)).statusCode, 400);
  }
  assert.equal(db.project.update.mock.callCount(), 0);
  assert.deepEqual(storedProjects, before);
});

test("changing the session user cannot edit the original owner's project", async () => {
  assert.equal((await request(projectId, otherId, "put", { name: "Changed" })).statusCode, 404);
  assert.equal(storedProjects[0].name, project.name);
});

test("project edit failures do not expose database details", async (context) => {
  context.mock.method(console, "error", () => {});
  db.project.update = mock.fn(async () => { throw new Error("private database details"); });
  const response = await request(projectId, ownerId, "put", { name: "Updated" });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Unable to update project" });
});

test("project deletion requires authentication before writing", async () => {
  const before = structuredClone(storedProjects);
  const response = await request(projectId, null, "delete");
  assert.equal(response.statusCode, 401);
  assert.equal(db.project.delete.mock.callCount(), 0);
  assert.deepEqual(storedProjects, before);
});

test("project deletion rejects malformed UUIDs before writing", async () => {
  for (const id of ["invalid", "", "123", "../../other-project"]) {
    const response = await request(id, ownerId, "delete");
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { message: "Project not found" });
  }
  assert.equal(db.project.delete.mock.callCount(), 0);
});

test("an owner can delete their project without affecting other projects", async () => {
  const otherProject = structuredClone(storedProjects[1]);
  const response = await request(projectId, ownerId, "delete", { ownerId: otherId, id: otherProjectId });
  assert.equal(response.statusCode, 204);
  assert.equal(response.ended, true);
  assert.equal(response.body, undefined);
  assert.deepEqual(db.project.delete.mock.calls[0].arguments[0].where, { id: projectId, ownerId });
  assert.deepEqual(storedProjects, [otherProject]);
  assert.equal((await request()).statusCode, 404);
});

test("project deletion returns the same response for foreign and missing projects", async () => {
  const before = structuredClone(storedProjects);
  const foreign = await request(otherProjectId, ownerId, "delete");
  const missing = await request(missingId, ownerId, "delete");
  assert.equal(foreign.statusCode, 404);
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(foreign.body, { message: "Project not found" });
  assert.deepEqual(foreign.body, missing.body);
  assert.deepEqual(storedProjects, before);
});

test("changing the session user cannot delete the original owner's project", async () => {
  const before = structuredClone(storedProjects);
  assert.equal((await request(projectId, otherId, "delete")).statusCode, 404);
  assert.deepEqual(storedProjects, before);
});

test("deleting an already deleted project returns not found", async () => {
  assert.equal((await request(projectId, ownerId, "delete")).statusCode, 204);
  const response = await request(projectId, ownerId, "delete");
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { message: "Project not found" });
});

test("project deletion failures preserve data and do not expose database details", async (context) => {
  context.mock.method(console, "error", () => {});
  const before = structuredClone(storedProjects);
  db.project.delete = mock.fn(async () => { throw new Error("private database details"); });
  const response = await request(projectId, ownerId, "delete");
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Unable to delete project" });
  assert.deepEqual(storedProjects, before);
});

