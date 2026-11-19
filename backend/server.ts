import express, { type Request, type Response } from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import session from "express-session";
import { db } from "./src/prisma/db.js";
import { validateProjectInput } from "./src/projects/validation.js";
import {
  accessibleProjectWhere,
  findAccessibleProject,
  findOwnedProject,
  UUID_PATTERN,
} from "./src/projects/access.js";
import { pathToFileURL } from "node:url";
import { requireAdmin } from "./src/admin/authorization.js";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export const app = express();
const PORT = 3001;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "goal-sync-development-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
  })
);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    message: "Goal Sync backend connected successfully",
  });
});

app.post("/api/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    const existingUser = await db.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "A user with that email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role: "user",
      },
    });

    return res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        attributes: user.attributes,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      message: "Unable to create account",
    });
  }
});

app.post("/api/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await db.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    req.session.userId = user.id;

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,  
        email: user.email,
        role: user.role,
        attributes: user.attributes,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Unable to log in",
    });
  }
});

const publicUser = (user: { id: string; name: string; email: string }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});


app.post("/api/logout", (req: Request, res: Response) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);

      return res.status(500).json({
        message: "Unable to log out",
      });
    }

    res.clearCookie("connect.sid");

    return res.status(200).json({
      message: "Logout successful",
    });
  });
});



app.get("/api/friends", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const requests = await db.friendRequest.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: { in: ["pending", "accepted"] },
      },
      include: {
        sender: true,
        receiver: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const friends = requests
      .filter((request) => request.status === "accepted")
      .map((request) =>
        publicUser(
          request.senderId === userId ? request.receiver : request.sender
        )
      );

    const incoming = requests
      .filter(
        (request) =>
          request.status === "pending" && request.receiverId === userId
      )
      .map((request) => ({
        id: request.id,
        user: publicUser(request.sender),
      }));

    const outgoing = requests
      .filter(
        (request) => request.status === "pending" && request.senderId === userId
      )
      .map((request) => ({
        id: request.id,
        user: publicUser(request.receiver),
      }));

    return res.status(200).json({ friends, incoming, outgoing });
  } catch (error) {
    console.error("Friends list error:", error);

    return res.status(500).json({
      message: "Unable to load friends",
    });
  }
});

app.post("/api/friends/requests", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const { email } = req.body;

    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const receiver = await db.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!receiver) {
      return res.status(404).json({
        message: "No user with that email exists",
      });
    }

    if (receiver.id === userId) {
      return res.status(400).json({
        message: "You can't add yourself as a friend",
      });
    }

    const existing = await db.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: userId },
        ],
      },
    });

    if (existing?.status === "accepted") {
      return res.status(409).json({
        message: `You're already friends with ${receiver.name}`,
      });
    }

    if (existing?.status === "pending" && existing.senderId === userId) {
      return res.status(409).json({
        message: `You already sent ${receiver.name} a friend request`,
      });
    }

    // They already invited us, so adding them back accepts it.
    if (existing?.status === "pending") {
      await db.friendRequest.update({
        where: { id: existing.id },
        data: { status: "accepted" },
      });

      return res.status(200).json({
        message: `You and ${receiver.name} are now friends`,
      });
    }

    // A declined request can be sent again.
    if (existing) {
      await db.friendRequest.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          senderId: userId,
          receiverId: receiver.id,
          createdAt: new Date(),
        },
      });
    } else {
      await db.friendRequest.create({
        data: {
          senderId: userId,
          receiverId: receiver.id,
        },
      });
    }

    return res.status(201).json({
      message: `Friend request sent to ${receiver.name}`,
    });
  } catch (error) {
    console.error("Friend request error:", error);

    return res.status(500).json({
      message: "Unable to send friend request",
    });
  }
});

app.post(
  "/api/friends/requests/:id/:action",
  async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.status(401).json({
          message: "Not authenticated",
        });
      }

      const { id, action } = req.params;

      if (action !== "accept" && action !== "decline") {
        return res.status(400).json({
          message: "Action must be accept or decline",
        });
      }

      const request = await db.friendRequest.findUnique({
        where: {
          id: String(id),
        },
      });

      if (
        !request ||
        request.receiverId !== userId ||
        request.status !== "pending"
      ) {
        return res.status(404).json({
          message: "Friend request not found",
        });
      }

      await db.friendRequest.update({
        where: { id: request.id },
        data: { status: action === "accept" ? "accepted" : "declined" },
      });

      return res.status(200).json({
        message:
          action === "accept"
            ? "Friend request accepted"
            : "Friend request declined",
      });
    } catch (error) {
      console.error("Friend request response error:", error);

      return res.status(500).json({
        message: "Unable to update friend request",
      });
    }
  }
);

app.get("/api/projects", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Not authenticated",
    });
  }

  try {
    const projects = await db.project.findMany({
      where: accessibleProjectWhere(req.session.userId),
      include: {
        owner: { select: { id: true, name: true } },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      projects,
    });
  } catch (error) {
    console.error("Project list error:", error);

    return res.status(500).json({
      message: "Unable to load projects",
    });
  }
});

app.get("/api/projects/:id", async (req: Request<{ id: string }>, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(404).json({ message: "Project not found" });
  }

  try {
    const found = await db.project.findFirst({
      where: { id: req.params.id, ...accessibleProjectWhere(req.session.userId) },
      select: {
        id: true, name: true, description: true, goal: true, targetDate: true, ownerId: true,
        owner: { select: { id: true, name: true, email: true } },
        collaborators: {
          select: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!found) {
      return res.status(404).json({ message: "Project not found" });
    }

    const { ownerId, owner, collaborators, ...project } = found;

    return res.status(200).json({
      project,
      isOwner: ownerId === req.session.userId,
      viewerId: req.session.userId,
      owner,
      collaborators: collaborators.map((collaborator) => collaborator.user),
    });
  } catch (error) {
    console.error("Project detail error:", error);
    return res.status(500).json({ message: "Unable to load project" });
  }
});

app.put("/api/projects/:id", async (req: Request<{ id: string }>, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(404).json({ message: "Project not found" });
  }

  const result = validateProjectInput(req.body);
  if (result.error !== undefined) {
    return res.status(400).json({ message: result.error });
  }

  try {
    const project = await db.project.update({
      where: { id: req.params.id, ownerId: req.session.userId },
      data: result.data,
      select: { id: true, name: true, description: true, goal: true, targetDate: true },
    });
    return res.status(200).json({ message: "Project updated successfully", project });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ message: "Project not found" });
    }
    console.error("Project update error:", error);
    return res.status(500).json({ message: "Unable to update project" });
  }
});

// Only the owner can add collaborators, and only from their accepted friends.
app.post("/api/projects/:id/collaborators", async (req: Request<{ id: string }>, res: Response) => {
  const viewerId = req.session.userId;
  if (!viewerId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(404).json({ message: "Project not found" });
  }

  const userId = req.body?.userId;
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
    return res.status(400).json({ message: "A valid user ID is required" });
  }

  try {
    const project = await findOwnedProject(req.params.id, viewerId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (userId === viewerId) {
      return res.status(400).json({ message: "You already own this project" });
    }

    const friendship = await db.friendRequest.findFirst({
      where: {
        status: "accepted",
        OR: [
          { senderId: viewerId, receiverId: userId },
          { senderId: userId, receiverId: viewerId },
        ],
      },
      select: { id: true },
    });

    if (!friendship) {
      return res.status(400).json({ message: "You can only add friends as collaborators" });
    }

    const collaborator = await db.projectCollaborator.create({
      data: { projectId: project.id, userId },
      select: { user: { select: { id: true, name: true, email: true } } },
    });

    return res.status(201).json({
      message: `${collaborator.user.name} added as a collaborator`,
      collaborator: collaborator.user,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return res.status(409).json({ message: "That friend is already a collaborator" });
    }
    console.error("Add collaborator error:", error);
    return res.status(500).json({ message: "Unable to add collaborator" });
  }
});

// The owner can remove anyone; a collaborator can remove themselves to leave.
app.delete(
  "/api/projects/:id/collaborators/:userId",
  async (req: Request<{ id: string; userId: string }>, res: Response) => {
    const viewerId = req.session.userId;
    if (!viewerId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!UUID_PATTERN.test(req.params.id) || !UUID_PATTERN.test(req.params.userId)) {
      return res.status(404).json({ message: "Collaborator not found" });
    }

    try {
      const project = await findAccessibleProject(req.params.id, viewerId);
      if (!project || (project.ownerId !== viewerId && req.params.userId !== viewerId)) {
        return res.status(404).json({ message: "Collaborator not found" });
      }

      const result = await db.projectCollaborator.deleteMany({
        where: { projectId: project.id, userId: req.params.userId },
      });

      if (result.count === 0) {
        return res.status(404).json({ message: "Collaborator not found" });
      }

      return res.status(200).json({
        message: req.params.userId === viewerId ? "You left the project" : "Collaborator removed",
      });
    } catch (error) {
      console.error("Remove collaborator error:", error);
      return res.status(500).json({ message: "Unable to remove collaborator" });
    }
  }
);

app.post("/api/projects", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Not authenticated",
    });
  }

  const result = validateProjectInput(req.body);

  if (result.error !== undefined) {
    return res.status(400).json({
      message: result.error,
    });
  }

  try {
    const owner = await db.user.findUnique({
      where: {
        id: req.session.userId,
      },
      select: {
        id: true,
      },
    });

    if (!owner) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const project = await db.project.create({
      data: {
        ...result.data,
        ownerId: owner.id,
      },
    });

    return res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    console.error("Project creation error:", error);

    return res.status(500).json({
      message: "Unable to create project",
    });
  }
});

app.get("/api/me", async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const user = await db.user.findUnique({
      where: {
        id: req.session.userId,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        attributes: user.attributes,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);

    return res.status(500).json({
      message: "Unable to verify session",
    });
  }
});
const adminUserSelect = { id: true, name: true, email: true, role: true, createdAt: true } as const;

app.get("/api/admin/users", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await db.user.findMany({
      select: adminUserSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return res.status(200).json({ users });
  } catch (error) {
    console.error("Admin user list error:", error);
    return res.status(500).json({ message: "Unable to load users" });
  }
});

app.patch("/api/admin/users/:id/role", requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ message: "User ID must be a valid UUID" });
  }
  const role = req.body?.role;
  if (role !== "user" && role !== "admin") {
    return res.status(400).json({ message: "Role must be user or admin" });
  }
  const userId = req.params.id.toLowerCase();
  if (userId === req.session.userId?.toLowerCase()) {
    return res.status(400).json({ message: "You cannot change your own role" });
  }

  try {
    const user = await db.user.update({
      where: { id: userId },
      data: { role },
      select: adminUserSelect,
    });
    return res.status(200).json({ message: "User role updated", user });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    console.error("Admin role update error:", error);
    return res.status(500).json({ message: "Unable to update user role" });
  }
});

const TASK_PRIORITIES = ["low", "medium", "high"];

app.get("/api/tasks", async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const { projectId, includeCompleted } = req.query;

    if (projectId !== undefined) {
      if (typeof projectId !== "string" || !UUID_PATTERN.test(projectId)) {
        return res.status(400).json({ message: "Project ID must be a valid UUID" });
      }

      if (!(await findAccessibleProject(projectId, req.session.userId))) {
        return res.status(404).json({ message: "Project not found" });
      }
    }

    if (includeCompleted !== undefined && includeCompleted !== "true" && includeCompleted !== "false") {
      return res.status(400).json({ message: "includeCompleted must be true or false" });
    }

    // A project view shows everyone's tasks in that project; the default
    // view is the user's own tasks in projects they can still open, so
    // tasks left behind in a project they left don't linger.
    const tasks = await db.task.findMany({
      where: {
        ...(typeof projectId === "string"
          ? { projectId }
          : { userId: req.session.userId, project: accessibleProjectWhere(req.session.userId) }),
        ...(includeCompleted === "true" ? {} : { completedAt: null }),
      },
      ...(typeof projectId === "string"
        ? { include: { user: { select: { id: true, name: true } } } }
        : {}),
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      tasks,
    });
  } catch (error) {
    console.error("Task list error:", error);

    return res.status(500).json({
      message: "Unable to load tasks",
    });
  }
});

app.post("/api/tasks", async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const { title, description, dueDate, priority, projectId } = req.body ?? {};

    if (typeof projectId !== "string" || !UUID_PATTERN.test(projectId)) {
      return res.status(400).json({ message: "A valid project ID is required" });
    }

    const project = await findAccessibleProject(projectId, req.session.userId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const trimmedTitle = typeof title === "string" ? title.trim() : "";

    if (!trimmedTitle) {
      return res.status(400).json({
        message: "Task title is required",
      });
    }

    const taskPriority = priority || "medium";

    if (!TASK_PRIORITIES.includes(taskPriority)) {
      return res.status(400).json({
        message: "Priority must be low, medium, or high",
      });
    }

    let taskDueDate: Date | null = null;

    if (dueDate) {
      taskDueDate = new Date(dueDate);

      if (Number.isNaN(taskDueDate.getTime())) {
        return res.status(400).json({
          message: "Due date is invalid",
        });
      }
    }

    const trimmedDescription =
      typeof description === "string" ? description.trim() : "";

    const task = await db.task.create({
      data: {
        title: trimmedTitle,
        description: trimmedDescription || null,
        dueDate: taskDueDate,
        priority: taskPriority,
        userId: req.session.userId,
        projectId: project.id,
      },
    });

    return res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("Task creation error:", error);

    return res.status(500).json({
      message: "Unable to create task",
    });
  }
});

app.patch("/api/tasks/:id/status", async (req: Request<{ id: string }>, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(404).json({ message: "Task not found" });
  }

  const status = req.body?.status;
  if (status !== "todo" && status !== "complete") {
    return res.status(400).json({ message: "Status must be todo or complete" });
  }

  try {
    const task = await db.task.update({
      where: { id: req.params.id, userId: req.session.userId },
      data: { completedAt: status === "complete" ? new Date() : null },
    });
    return res.status(200).json({ message: status === "complete" ? "Task completed" : "Task moved to to do", task });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ message: "Task not found" });
    }
    console.error("Task status error:", error);
    return res.status(500).json({ message: "Unable to update task status" });
  }
});

app.patch(
  "/api/tasks/:id/complete",
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: "Not authenticated",
        });
      }

      if (!UUID_PATTERN.test(req.params.id)) {
        return res.status(404).json({
          message: "Task not found",
        });
      }

      const result = await db.task.updateMany({
        where: {
          id: req.params.id,
          userId: req.session.userId,
          completedAt: null,
        },
        data: {
          completedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return res.status(404).json({
          message: "Task not found",
        });
      }

      return res.status(200).json({
        message: "Task completed",
      });
    } catch (error) {
      console.error("Task completion error:", error);

      return res.status(500).json({
        message: "Unable to complete task",
      });
    }
  }
);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}
