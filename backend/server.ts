import express, { type Request, type Response } from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import session from "express-session";
import { db } from "./src/prisma/db.js";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const app = express();
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

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
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
const TASK_PRIORITIES = ["low", "medium", "high"];

app.get("/api/tasks", async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const tasks = await db.task.findMany({
      where: {
        userId: req.session.userId,
        completedAt: null,
      },
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

    const { title, description, dueDate, priority } = req.body;

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
