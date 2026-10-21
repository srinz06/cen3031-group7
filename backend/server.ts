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