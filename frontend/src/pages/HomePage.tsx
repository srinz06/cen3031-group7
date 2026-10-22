import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
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

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  attributes: unknown;
};

export function HomePage() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
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