import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, CalendarDays, FolderKanban } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateProjectPage() {
  const navigate = useNavigate();

  const [session, setSession] = useState<"loading" | "ready" | "error">("loading");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const checkSession = async () => {
      try {
        const response = await fetch("http://localhost:3001/api/me", {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 401) {
          navigate("/", { replace: true });
          return;
        }

        setSession(response.ok ? "ready" : "error");
      } catch {
        if (!controller.signal.aborted) {
          setSession("error");
        }
      }
    };

    checkSession();

    return () => controller.abort();
  }, [navigate]);

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!name.trim()) {
      setError("Enter a project name.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const response = await fetch("http://localhost:3001/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          goal: goal.trim(),
          targetDate: targetDate || null,
        }),
      });

      if (response.status === 401) {
        navigate("/", { replace: true });
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to create project.");
        return;
      }

      navigate("/home");
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = () => {
    setError("");
  };

  if (session === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground" role="status">
          Loading Goal Sync...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/home" className="text-xl font-bold tracking-tight">
            Goal Sync
          </Link>

          <Link to="/home" className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeft /> Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm font-medium text-muted-foreground">
          YOUR WORKSPACE
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Create a project
        </h1>

        <p className="mt-2 text-muted-foreground">
          Give your next goal a home. Start with a name and a few details.
        </p>

        {session === "error" ? (
          <Alert variant="destructive" className="mt-8">
            <AlertDescription>
              Unable to verify your session. Check that the backend is running,
              then refresh this page.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="mt-8 grid items-start gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Project details</CardTitle>
                <CardDescription>
                  Only the project name is required.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form
                  onSubmit={handleCreateProject}
                  onChange={handleFormChange}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <Label htmlFor="project-name">
                      Project name <span aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="project-name"
                      type="text"
                      placeholder="e.g. Launch our study group"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project-goal">
                      Goal
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <textarea
                      id="project-goal"
                      placeholder="What will success look like?"
                      value={goal}
                      onChange={(event) => setGoal(event.target.value)}
                      maxLength={2000}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project-description">
                      Description
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <textarea
                      id="project-description"
                      placeholder="What do you want to accomplish?"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      maxLength={2000}
                      rows={5}
                      className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project-date">
                      Target date
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="project-date"
                      type="date"
                      min="0001-01-01"
                      max="9999-12-31"
                      value={targetDate}
                      onChange={(event) => setTargetDate(event.target.value)}
                    />
                  </div>

                  {error && (
                    <div role="alert">
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
                    <Link
                      to="/home"
                      className={buttonVariants({ variant: "outline" })}
                    >
                      Cancel
                    </Link>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Creating project..." : "Create project"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <aside aria-label="Project preview">
              <Card>
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                    <FolderKanban className="size-5" />
                  </div>

                  <CardDescription>PROJECT PREVIEW</CardDescription>

                  <CardTitle className="break-words">
                    {name.trim() || "Your project name"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-5">
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {description.trim() || "Your project description will appear here."}
                  </p>

                  {goal.trim() && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Goal</p>
                      <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {goal.trim()}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
                    <CalendarDays className="size-4 shrink-0" />
                    <span>
                      {targetDate
                        ? `Target: ${new Date(`${targetDate}T00:00:00`).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}`
                        : "No target date"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
