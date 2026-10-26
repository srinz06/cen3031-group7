import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Check,
  FolderKanban,
  ListTodo,
  Users,
  UserRound,
} from "lucide-react";

import {
  CreateTaskDialog,
  type Task,
} from "@/components/tasks/CreateTaskDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  attributes: unknown;
};

const formatDueDate = (dueDate: string) =>
  new Date(dueDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export function HomePage() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch("http://localhost:3001/api/me", {
          credentials: "include",
        });

        if (!response.ok) {
          navigate("/", { replace: true });
          return;
        }

        const data = await response.json();
        setUser(data.user);

        const tasksResponse = await fetch("http://localhost:3001/api/tasks", {
          credentials: "include",
        });

        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          setTasks(tasksData.tasks);
        }
      } catch (error) {
        console.error(error);
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [navigate]);

  const handleCompleteTask = async (taskId: string) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/tasks/${taskId}/complete`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      if (response.ok) {
        setTasks((currentTasks) =>
          currentTasks.filter((task) => task.id !== taskId)
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading Goal Sync...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Goal Sync</h1>
            <p className="text-sm text-muted-foreground">
              Social productivity workspace
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>

            <div className="flex size-10 items-center justify-center rounded-full border bg-muted">
              <UserRound className="size-5" />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-10">
          <p className="text-sm font-medium text-muted-foreground">
            YOUR WORKSPACE
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Welcome back, {user.name}.
          </h2>

          <p className="mt-2 max-w-2xl text-muted-foreground">
            Organize your projects, keep track of tasks, and stay connected
            with friends and collaborators.
          </p>
        </section>

        <section>
          <h3 className="mb-4 text-lg font-semibold">Overview</h3>

          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                  <FolderKanban className="size-5" />
                </div>

                <CardTitle>Projects</CardTitle>

                <CardDescription>
                  Create projects and keep your work organized.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Your project activity will appear here.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                  <ListTodo className="size-5" />
                </div>

                <CardTitle>Tasks</CardTitle>

                <CardDescription>
                  Track what needs to be done and monitor progress.
                </CardDescription>

                <CardAction>
                  <CreateTaskDialog
                    onTaskCreated={(task) =>
                      setTasks((currentTasks) => [task, ...currentTasks])
                    }
                  />
                </CardAction>
              </CardHeader>

              <CardContent>
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tasks yet. Click + to create one.
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto">
                    {tasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-start gap-2 rounded-lg border p-3"
                      >
                        <Button
                          variant="outline"
                          size="icon-xs"
                          aria-label={`Mark "${task.title}" as complete`}
                          title="Mark as complete"
                          className="mt-px rounded-full text-transparent hover:text-foreground"
                          onClick={() => handleCompleteTask(task.id)}
                        >
                          <Check />
                        </Button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{task.title}</p>
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs capitalize text-muted-foreground">
                              {task.priority}
                            </span>
                          </div>

                          {task.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {task.description}
                            </p>
                          )}

                          {task.dueDate && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Due {formatDueDate(task.dueDate)}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Users className="size-5" />
                </div>

                <CardTitle>Friends</CardTitle>

                <CardDescription>
                  Connect with friends and stay accountable together.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Your friend activity will appear here.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Updates from your projects, tasks, and collaborators will
                appear here.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  No recent activity yet.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}