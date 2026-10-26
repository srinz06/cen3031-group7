import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  FolderKanban,
  ListTodo,
  Users,
  UserRound,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  attributes: unknown;
};

type Project = {
  id: string;
  name: string;
  description: string;
  goal: string;
  targetDate: string | null;
};

export function HomePage() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsError, setProjectsError] = useState("");

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

        try {
          const projectsResponse = await fetch("http://localhost:3001/api/projects", {
            credentials: "include",
          });

          if (!projectsResponse.ok) {
            setProjectsError("Unable to load projects. Please refresh to try again.");
            return;
          }

          const projectsData = await projectsResponse.json();
          setProjects(projectsData.projects);
        } catch {
          setProjectsError("Unable to connect to the server to load projects.");
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
                  {projects.length === 0
                    ? "Start by creating your first project."
                    : `${projects.length} ${projects.length === 1 ? "project" : "projects"} in your workspace.`}
                </p>
                <Link to="/projects/new" className={buttonVariants({ className: "mt-4" })}>
                  Create project
                </Link>
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
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Your task activity will appear here.
                </p>
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

        <section className="mt-8" aria-labelledby="projects-heading">
          <h3 id="projects-heading" className="mb-4 text-lg font-semibold">
            Your projects
          </h3>

          {projectsError ? (
            <Alert variant="destructive">
              <AlertDescription>{projectsError}</AlertDescription>
            </Alert>
          ) : projects.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No projects yet. Create a project to start organizing your work.
            </p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card key={project.id}>
                  <CardHeader>
                    <CardTitle className="break-words">{project.name}</CardTitle>
                    <CardDescription className="whitespace-pre-wrap break-words">
                      {project.description || "No description yet."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {project.goal && (
                      <p className="whitespace-pre-wrap break-words text-sm">
                        <span className="font-medium">Goal: </span>
                        {project.goal}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {project.targetDate
                        ? `Target: ${new Date(project.targetDate).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })}`
                        : "No target date"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
