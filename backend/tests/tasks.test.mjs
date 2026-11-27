import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
const { app } = await import("../server.ts");
const { db } = await import("../src/prisma/db.ts");

const ownerId = "10000000-0000-0000-0000-000000000001";
const otherId = "10000000-0000-0000-0000-000000000002";
const projectId = "20000000-0000-0000-0000-000000000001";
const otherProjectId = "20000000-0000-0000-0000-000000000002";
const missingProjectId = "20000000-0000-0000-0000-000000000003";
const taskId = "30000000-0000-0000-0000-000000000001";
const completedId = "30000000-0000-0000-0000-000000000002";
const otherTaskId = "30000000-0000-0000-0000-000000000003";
const legacyTaskId = "30000000-0000-0000-0000-000000000004";
const collaboratorId = "10000000-0000-0000-0000-000000000003";
let tasks;

// Mirrors accessibleProjectWhere: the owner or a listed collaborator matches.
const canAccess = (project, where) => where.ownerId !== undefined
  ? project.ownerId === where.ownerId
  : where.OR.some((clause) => clause.ownerId === project.ownerId ||
    project.collaboratorIds.includes(clause.collaborators?.some.userId));
// formerId used to collaborate on projectId and still has a task there.
const formerId = "10000000-0000-0000-0000-000000000004";
const formerTaskId = "30000000-0000-0000-0000-000000000005";
const projects = [
  { id: projectId, ownerId, collaboratorIds: [collaboratorId] },
  { id: otherProjectId, ownerId: otherId, collaboratorIds: [] },
];
// Mirrors a Prisma relation filter on the task's project; no filter matches everything.
const inAccessibleProject = (task, where) => where === undefined ||
  projects.some((project) => project.id === task.projectId && canAccess(project, where));
const originalMethods = {
  findFirst: db.project.findFirst,
  findMany: db.task.findMany,
  create: db.task.create,
  updateMany: db.task.updateMany,
  update: db.task.update,
};

beforeEach(() => {
  tasks = [
    { id: taskId, userId: ownerId, projectId, completedAt: null },
    { id: completedId, userId: ownerId, projectId, completedAt: new Date("2026-01-01") },
    { id: otherTaskId, userId: otherId, projectId: otherProjectId, completedAt: null },
    { id: legacyTaskId, userId: ownerId, projectId: null, completedAt: null },
  ];
  db.project.findFirst = mock.fn(async ({ where }) => {
    const found = projects.find((project) => project.id === where.id && canAccess(project, where));
    return found ? { id: found.id, ownerId: found.ownerId } : null;
  });
  db.task.findMany = mock.fn(async ({ where }) => tasks.filter((task) =>
    (where.userId === undefined || task.userId === where.userId) &&
    (where.projectId === undefined || task.projectId === where.projectId) &&
    (where.completedAt === undefined || task.completedAt === where.completedAt)
  ));
  db.task.create = mock.fn(async ({ data }) => ({ id: "new-task", ...data }));
  db.task.updateMany = mock.fn(async ({ where, data }) => {
    const matching = tasks.filter((task) => task.id === where.id && task.userId === where.userId && task.completedAt === where.completedAt);
    matching.forEach((task) => Object.assign(task, data));
    return { count: matching.length };
  });
  db.task.update = mock.fn(async ({ where, data }) => {
    const task = tasks.find((item) => item.id === where.id && item.userId === where.userId &&
      inAccessibleProject(item, where.project));
    if (!task) throw Object.assign(new Error("Record not found"), { code: "P2025" });
    return Object.assign(task, data);
  });
});

afterEach(() => {
  db.project.findFirst = originalMethods.findFirst;
  db.task.findMany = originalMethods.findMany;
  db.task.create = originalMethods.create;
  db.task.updateMany = originalMethods.updateMany;
  db.task.update = originalMethods.update;
});

async function request(method, path, { userId = ownerId, query = {}, body = {}, params = {} } = {}) {
  const route = app.router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  await route.stack[0].handle({ session: { userId }, query, body, params }, response);
  return response;
}

test("all task routes reject an unauthenticated user before querying the database", async () => {
  for (const [method, path] of [["get", "/api/tasks"], ["post", "/api/tasks"], ["put", "/api/tasks/:id"], ["patch", "/api/tasks/:id/complete"], ["patch", "/api/tasks/:id/status"]]) {
    assert.equal((await request(method, path, { userId: null })).statusCode, 401);
  }
  assert.equal(db.project.findFirst.mock.callCount(), 0);
  assert.equal(db.task.findMany.mock.callCount(), 0);
  assert.equal(db.task.create.mock.callCount(), 0);
  assert.equal(db.task.updateMany.mock.callCount(), 0);
  assert.equal(db.task.update.mock.callCount(), 0);
});

test("creation requires a project UUID, including when the request body is missing", async () => {
  for (const value of [undefined, null, "", "bad", [], {}, 42]) {
    assert.equal((await request("post", "/api/tasks", { body: { title: "Task", projectId: value } })).statusCode, 400);
  }
  assert.equal((await request("post", "/api/tasks", { body: null })).statusCode, 400);
  assert.equal(db.project.findFirst.mock.callCount(), 0);
  assert.equal(db.task.create.mock.callCount(), 0);
});

test("creation rejects another user's project and nonexistent projects", async () => {
  for (const id of [otherProjectId, missingProjectId]) {
    assert.equal((await request("post", "/api/tasks", { body: { title: "Task", projectId: id } })).statusCode, 404);
  }
  assert.equal(db.task.create.mock.callCount(), 0);
});

test("creation stores the authorized project and session user, ignoring a client-supplied user", async () => {
  const response = await request("post", "/api/tasks", {
    body: { projectId, title: "  Study  ", description: "  Chapter 1  ", userId: otherId, priority: "high", dueDate: "2026-12-01" },
  });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body.task, {
    id: "new-task", projectId, userId: ownerId, title: "Study", description: "Chapter 1",
    priority: "high", dueDate: new Date("2026-12-01"),
  });
});

test("existing task validation and default priority remain effective", async () => {
  for (const body of [{ title: " " }, { title: "Task", priority: "urgent" }, { title: "Task", dueDate: "invalid" }]) {
    assert.equal((await request("post", "/api/tasks", { body: { ...body, projectId } })).statusCode, 400);
  }
  const response = await request("post", "/api/tasks", { body: { projectId, title: "Task" } });
  assert.equal(response.body.task.priority, "medium");
  assert.equal(response.body.task.description, null);
  assert.equal(response.body.task.dueDate, null);
});

test("default GET preserves the personal open-task overview, including legacy unassigned tasks", async () => {
  const response = await request("get", "/api/tasks");
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.tasks.map((task) => task.id), [taskId, legacyTaskId]);
  assert.equal(db.project.findFirst.mock.callCount(), 0);
  assert.deepEqual(db.task.findMany.mock.calls[0].arguments[0].orderBy, { createdAt: "desc" });
});

test("project filtering returns only the selected project's open tasks", async () => {
  const response = await request("get", "/api/tasks", { query: { projectId } });
  assert.deepEqual(response.body.tasks.map((task) => task.id), [taskId]);
  assert.deepEqual(db.project.findFirst.mock.calls[0].arguments[0].where, {
    id: projectId,
    OR: [{ ownerId }, { collaborators: { some: { userId: ownerId } } }],
  });
});

test("a collaborator sees every member's tasks in a shared project", async () => {
  tasks.push({ id: "collab-task", userId: collaboratorId, projectId, completedAt: null });
  const response = await request("get", "/api/tasks", { userId: collaboratorId, query: { projectId } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.tasks.map((task) => task.id), [taskId, "collab-task"]);
  assert.deepEqual(db.task.findMany.mock.calls[0].arguments[0].include, { user: { select: { id: true, name: true } } });
});

test("a collaborator's default task list stays limited to their own tasks", async () => {
  tasks.push({ id: "collab-task", userId: collaboratorId, projectId, completedAt: null });
  const response = await request("get", "/api/tasks", { userId: collaboratorId });
  assert.deepEqual(response.body.tasks.map((task) => task.id), ["collab-task"]);
});

test("the default task list only includes projects the user can still open", async () => {
  await request("get", "/api/tasks", { userId: collaboratorId });
  assert.deepEqual(db.task.findMany.mock.calls[0].arguments[0].where.project, {
    OR: [{ ownerId: collaboratorId }, { collaborators: { some: { userId: collaboratorId } } }],
  });
});

test("a collaborator can create tasks in a shared project as themselves", async () => {
  const response = await request("post", "/api/tasks", {
    userId: collaboratorId, body: { projectId, title: "Draft slides", userId: ownerId },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.task.userId, collaboratorId);
  assert.equal(response.body.task.projectId, projectId);
});

test("a collaborator cannot change the status of another member's task", async () => {
  const before = structuredClone(tasks);
  const response = await request("patch", "/api/tasks/:id/status", {
    userId: collaboratorId, params: { id: taskId }, body: { status: "complete" },
  });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(tasks, before);
});

test("includeCompleted=true includes completed tasks for project progress", async () => {
  const response = await request("get", "/api/tasks", { query: { projectId, includeCompleted: "true" } });
  assert.deepEqual(response.body.tasks.map((task) => task.id), [taskId, completedId]);
});

test("includeCompleted=false continues returning only open tasks", async () => {
  const response = await request("get", "/api/tasks", { query: { projectId, includeCompleted: "false" } });
  assert.deepEqual(response.body.tasks.map((task) => task.id), [taskId]);
});

test("includeCompleted without a project still returns only the authenticated user's tasks", async () => {
  const response = await request("get", "/api/tasks", { query: { includeCompleted: "true" } });
  assert.deepEqual(response.body.tasks.map((task) => task.id), [taskId, completedId, legacyTaskId]);
});

test("GET rejects malformed project IDs and malformed completed-task options", async () => {
  for (const value of ["", "bad", [projectId], {}]) {
    assert.equal((await request("get", "/api/tasks", { query: { projectId: value } })).statusCode, 400);
  }
  for (const value of ["", "yes", ["true"], {}]) {
    assert.equal((await request("get", "/api/tasks", { query: { includeCompleted: value } })).statusCode, 400);
  }
  assert.equal(db.task.findMany.mock.callCount(), 0);
});

test("GET denies another user's project even when completed tasks are requested", async () => {
  for (const id of [otherProjectId, missingProjectId]) {
    assert.equal((await request("get", "/api/tasks", { query: { projectId: id, includeCompleted: "true" } })).statusCode, 404);
  }
  assert.equal(db.task.findMany.mock.callCount(), 0);
});

test("completion preserves the task and its project while setting completedAt", async () => {
  assert.equal((await request("patch", "/api/tasks/:id/complete", { params: { id: taskId } })).statusCode, 200);
  assert.equal(tasks[0].id, taskId);
  assert.equal(tasks[0].userId, ownerId);
  assert.equal(tasks[0].projectId, projectId);
  assert.ok(tasks[0].completedAt instanceof Date);
});

test("completion cannot change another user's task or an already completed task", async () => {
  const before = structuredClone(tasks);
  for (const id of [otherTaskId, completedId, missingProjectId, "invalid"]) {
    assert.equal((await request("patch", "/api/tasks/:id/complete", { params: { id } })).statusCode, 404);
  }
  assert.deepEqual(tasks, before);
});

test("legacy tasks can still be completed during the nullable stage", async () => {
  assert.equal((await request("patch", "/api/tasks/:id/complete", { params: { id: legacyTaskId } })).statusCode, 200);
  assert.ok(tasks.find((task) => task.id === legacyTaskId).completedAt instanceof Date);
});

test("a task can move from to do to complete and back without changing its identity or ownership", async () => {
  const before = structuredClone(tasks[0]);
  const completed = await request("patch", "/api/tasks/:id/status", {
    params: { id: taskId }, body: { status: "complete" },
  });
  assert.equal(completed.statusCode, 200);
  assert.ok(completed.body.task.completedAt instanceof Date);
  assert.equal((await request("get", "/api/tasks")).body.tasks.some((task) => task.id === taskId), false);

  const reopened = await request("patch", "/api/tasks/:id/status", {
    params: { id: taskId }, body: { status: "todo" },
  });
  assert.equal(reopened.statusCode, 200);
  assert.equal(reopened.body.task.completedAt, null);
  assert.deepEqual(tasks[0], before);
  assert.equal((await request("get", "/api/tasks")).body.tasks.some((task) => task.id === taskId), true);
});

test("previously completed tasks can be reopened and remain within their project", async () => {
  const response = await request("patch", "/api/tasks/:id/status", {
    params: { id: completedId }, body: { status: "todo" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.task.completedAt, null);
  assert.equal(response.body.task.projectId, projectId);
  assert.equal(response.body.task.userId, ownerId);
  const open = await request("get", "/api/tasks", { query: { projectId } });
  assert.ok(open.body.tasks.some((task) => task.id === completedId));
});

test("status updates reject unsupported or missing statuses before writing", async () => {
  const before = structuredClone(tasks);
  for (const status of [undefined, null, "", "in_progress", "completed", true, [], {}]) {
    const response = await request("patch", "/api/tasks/:id/status", { params: { id: taskId }, body: { status } });
    assert.equal(response.statusCode, 400);
  }
  assert.equal((await request("patch", "/api/tasks/:id/status", { params: { id: taskId }, body: null })).statusCode, 400);
  assert.equal(db.task.update.mock.callCount(), 0);
  assert.deepEqual(tasks, before);
});

test("status updates cannot modify another user's task or a missing task", async () => {
  const before = structuredClone(tasks);
  for (const id of [otherTaskId, missingProjectId, "invalid"]) {
    for (const status of ["todo", "complete"]) {
      assert.equal((await request("patch", "/api/tasks/:id/status", { params: { id }, body: { status } })).statusCode, 404);
    }
  }
  assert.deepEqual(tasks, before);
});

test("status updates ignore client-supplied ownership, project, and completion timestamp", async () => {
  const response = await request("patch", "/api/tasks/:id/status", {
    params: { id: taskId }, body: { status: "complete", userId: otherId, projectId: otherProjectId, completedAt: "forged", title: "Changed" },
  });
  assert.equal(response.statusCode, 200);
  const args = db.task.update.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, {
    id: taskId, userId: ownerId,
    project: { OR: [{ ownerId }, { collaborators: { some: { userId: ownerId } } }] },
  });
  assert.deepEqual(Object.keys(args.data), ["completedAt"]);
  assert.ok(args.data.completedAt instanceof Date);
  assert.equal(response.body.task.userId, ownerId);
  assert.equal(response.body.task.projectId, projectId);
  assert.equal(response.body.task.title, undefined);
});

test("status update failures return a safe error", async (context) => {
  context.mock.method(console, "error", () => {});
  db.task.update = mock.fn(async () => { throw new Error("private database details"); });
  const response = await request("patch", "/api/tasks/:id/status", { params: { id: taskId }, body: { status: "todo" } });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Unable to update task status" });
});

test("the task owner can edit title, description, due date, and priority", async () => {
  const response = await request("put", "/api/tasks/:id", {
    params: { id: taskId },
    body: { title: "  Revised  ", description: "  New details  ", dueDate: "2026-12-15", priority: "high" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.task.title, "Revised");
  assert.equal(response.body.task.description, "New details");
  assert.deepEqual(response.body.task.dueDate, new Date("2026-12-15T00:00:00.000Z"));
  assert.equal(response.body.task.priority, "high");
  assert.equal(tasks[0].title, "Revised");
});

test("editing can clear the description and due date and defaults the priority", async () => {
  Object.assign(tasks[0], { description: "Old", dueDate: new Date("2026-12-01"), priority: "high" });
  const response = await request("put", "/api/tasks/:id", {
    params: { id: taskId }, body: { title: "Task", description: "", dueDate: null },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.task.description, null);
  assert.equal(response.body.task.dueDate, null);
  assert.equal(response.body.task.priority, "medium");
});

test("editing ignores client-supplied ownership, project, and completion fields", async () => {
  const response = await request("put", "/api/tasks/:id", {
    params: { id: completedId },
    body: { title: "Renamed", userId: otherId, projectId: otherProjectId, completedAt: null, id: otherTaskId },
  });
  assert.equal(response.statusCode, 200);
  const args = db.task.update.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, {
    id: completedId, userId: ownerId,
    project: { OR: [{ ownerId }, { collaborators: { some: { userId: ownerId } } }] },
  });
  assert.deepEqual(Object.keys(args.data).sort(), ["description", "dueDate", "priority", "title"]);
  assert.equal(response.body.task.userId, ownerId);
  assert.equal(response.body.task.projectId, projectId);
  assert.ok(response.body.task.completedAt instanceof Date, "editing must not reopen a completed task");
});

test("editing rejects invalid input before writing", async () => {
  const before = structuredClone(tasks);
  for (const body of [
    null, {}, { title: " " }, { title: 42 }, { title: "Task", priority: "urgent" },
    { title: "Task", dueDate: "invalid" }, { title: "Task", dueDate: "2026-02-30" },
    { title: "Task", dueDate: "12/01/2026" }, { title: "Task", dueDate: 1764547200000 },
  ]) {
    assert.equal((await request("put", "/api/tasks/:id", { params: { id: taskId }, body })).statusCode, 400);
  }
  assert.equal(db.task.update.mock.callCount(), 0);
  assert.deepEqual(tasks, before);
});

test("editing cannot modify another user's task, a collaborator's task, or a missing task", async () => {
  const before = structuredClone(tasks);
  for (const [userId, id] of [[ownerId, otherTaskId], [collaboratorId, taskId], [ownerId, missingProjectId], [ownerId, "invalid"]]) {
    const response = await request("put", "/api/tasks/:id", { userId, params: { id }, body: { title: "Hijacked" } });
    assert.equal(response.statusCode, 404);
  }
  assert.deepEqual(tasks, before);
});

test("a former collaborator can no longer edit or change the status of their old tasks", async () => {
  tasks.push({ id: formerTaskId, userId: formerId, projectId, completedAt: null, title: "Old work" });
  const before = structuredClone(tasks);
  const edit = await request("put", "/api/tasks/:id", { userId: formerId, params: { id: formerTaskId }, body: { title: "Changed" } });
  assert.equal(edit.statusCode, 404);
  for (const status of ["complete", "todo"]) {
    const response = await request("patch", "/api/tasks/:id/status", { userId: formerId, params: { id: formerTaskId }, body: { status } });
    assert.equal(response.statusCode, 404);
  }
  assert.deepEqual(tasks, before);
});

test("legacy completion only matches tasks in projects the user can still open", async () => {
  await request("patch", "/api/tasks/:id/complete", { params: { id: taskId } });
  assert.deepEqual(db.task.updateMany.mock.calls[0].arguments[0].where.project, {
    OR: [{ ownerId }, { collaborators: { some: { userId: ownerId } } }],
  });
});

test("creation now rejects non-calendar and non-ISO due dates", async () => {
  for (const dueDate of ["2026-02-30", "12/01/2026", "2026-12-01T10:00:00Z", 1764547200000, true]) {
    assert.equal((await request("post", "/api/tasks", { body: { projectId, title: "Task", dueDate } })).statusCode, 400);
  }
  assert.equal(db.task.create.mock.callCount(), 0);
});

test("task update failures return a safe error", async (context) => {
  context.mock.method(console, "error", () => {});
  db.task.update = mock.fn(async () => { throw new Error("private database details"); });
  const response = await request("put", "/api/tasks/:id", { params: { id: taskId }, body: { title: "Task" } });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Unable to update task" });
});
