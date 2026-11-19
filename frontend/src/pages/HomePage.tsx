import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Activity, ArrowUpRight, CalendarDays, Check, FolderKanban, ListTodo, LogOut, Plus, ShieldCheck, Target, Users, X} from "lucide-react";
import { GoalSyncBrand } from "@/components/GoalSyncBrand";
import type { Task } from "@/components/tasks/CreateTaskDialog";
import { EditNameDialog } from "@/components/profile/EditNameDialog";
import type { Project } from "@/types/project";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  attributes: unknown;
};

type Friend = {
  id: string;
  name: string;
  email: string;
};

type FriendRequest = {
  id: string;
  user: Friend;
};

type FriendsData = {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
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
  const location = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsError, setProjectsError] = useState("");
  const [tasksError, setTasksError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const [friendMessage, setFriendMessage] = useState("");
  const [friendError, setFriendError] = useState("");

  const [friendsData, setFriendsData] = useState<FriendsData>({
    friends: [],
    incoming: [],
    outgoing: [],
  });

  const loadFriends = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/friends", {
        credentials: "include",
      });

      if (response.ok) {
        setFriendsData(await response.json());
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/projects", {
        credentials: "include",
      });

      if (!response.ok) {
        setProjectsError("Unable to load projects. Please refresh to try again.");
        return;
      }

      const data = await response.json();
      setProjects(data.projects);
      setProjectsError("");
    } catch (error) {
      console.error(error);
      setProjectsError("Unable to connect to the server to load projects.");
    }
  };

  const handleAddFriend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setFriendError("");
    setFriendMessage("");

    try {
      const response = await fetch(
        "http://localhost:3001/api/friends/requests",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: friendEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setFriendError(data.message);
        return;
      }

      setFriendMessage(data.message);
      setFriendEmail("");
      setShowAddFriend(false);
      loadFriends();
    } catch (error) {
      console.error(error);
      setFriendError("Unable to send friend request");
    }
  };

  const respondToRequest = async (
    requestId: string,
    action: "accept" | "decline"
  ) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/friends/requests/${requestId}/${action}`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setFriendMessage(data.message);
        return;
      }

      setFriendMessage(data.message);
      loadFriends();
    } catch (error) {
      console.error(error);
    }
  };

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

        await Promise.all([loadFriends(), loadProjects()]);

        try {
          const tasksResponse = await fetch("http://localhost:3001/api/tasks", {
            credentials: "include",
          });

          if (tasksResponse.ok) {
            const tasksData = await tasksResponse.json();
            setTasks(tasksData.tasks);
          } else {
            setTasksError("Unable to load your task overview. Please refresh to try again.");
          }
        } catch {
          setTasksError("Unable to connect to the server to load tasks.");
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

  const handleLogout = async () => {
  try {
    const response = await fetch("http://localhost:3001/api/logout", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      console.error("Unable to log out");
      return;
    }

    navigate("/", { replace: true });
  } catch (error) {
    console.error("Logout error:", error);
  }
};


  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4" role="status"><GoalSyncBrand /><p className="text-sm text-muted-foreground">Getting your workspace ready...</p></div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const overviewTasks = [...tasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }).slice(0, 5);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <h1><GoalSyncBrand /></h1>
          </div>

          <div className="flex items-center gap-3">
            {user.role === "admin" && (
              <Link to="/admin" className={buttonVariants({ variant: "outline" })}>
                <ShieldCheck aria-hidden="true" /> Admin Dashboard
              </Link>
            )}
            <div className="hidden text-right sm:block">
              <p className="max-w-64 truncate text-sm font-medium">{user.name}</p>
              <p className="max-w-64 truncate text-xs text-muted-foreground">{user.email}</p>
            </div>

            <EditNameDialog
              name={user.name}
              onNameUpdated={(name) => setUser((current) => (current ? { ...current, name } : current))}
            />

            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>
                <LogOut aria-hidden="true" />
                Log out
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <LogOut className="size-5" aria-hidden="true" />
                  </span>
                  <DialogTitle>Log out of Goal Sync?</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to log out? You can sign back in anytime to continue working on your goals.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button onClick={handleLogout}>
                    <LogOut aria-hidden="true" />
                    Yes, log out
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
        <section className="workspace-banner mb-9 rounded-2xl border bg-card p-6 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary">
            <Target className="size-4" aria-hidden="true" />
            YOUR DASHBOARD
          </p>

          <h2 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, {user.name}.
          </h2>

          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Organize your projects, keep track of tasks, and stay connected
            with friends and collaborators.
          </p>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold tracking-tight">At a glance</h3><span className="text-xs text-muted-foreground">Your goals, in sync</span></div>

          <div className="grid items-start gap-5 lg:grid-cols-3">
            <Card className="border-t-2 border-t-primary">
              <CardHeader>
                <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FolderKanban className="size-5" />
                </div>

                <CardTitle className="flex items-center gap-2">Projects <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs tabular-nums text-primary">{projects.length}</span></CardTitle>

                <CardDescription>
                  Create projects and keep your work organized.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {projects.length === 0
                    ? "Start by creating your first project."
                    : `${projects.length} ${
                        projects.length === 1 ? "project" : "projects"
                      } in your workspace.`}
                </p>

                <Link
                  to="/projects/new"
                  className={buttonVariants({ className: "mt-4" })}
                >
                  Create project
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-t-2 border-t-sky-600">
              <CardHeader>
                <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-400">
                  <ListTodo className="size-5" />
                </div>

                <CardTitle className="flex items-center gap-2">Tasks <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{tasks.length}</span></CardTitle>

                <CardDescription>
                  Your next five open tasks across projects. Open a project to manage its tasks.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {tasksError ? (
                  <Alert variant="destructive" role="alert"><AlertDescription>{tasksError}</AlertDescription></Alert>
                ) : tasks.length === 0 ? (
                  <div className="empty-state">
                    <ListTodo className="mb-1 size-7 text-sky-600" aria-hidden="true" />
                    <p className="font-medium text-foreground">No open tasks</p>
                    <p>Open a project below to plan your next step.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {overviewTasks.map((task) => (
                      <li
                        key={task.id}
                      >
                        <Link to={`/projects/${task.projectId}`} className="flex items-start gap-3 rounded-xl border bg-background/40 p-3 outline-none transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 break-words text-sm font-medium">{task.title}</p>

                            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs capitalize ${task.priority === "high" ? "bg-destructive/10 text-destructive" : task.priority === "medium" ? "bg-amber-500/10 text-amber-800 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
                              {task.priority}
                            </span>
                          </div>

                          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                            <FolderKanban className="mt-px size-3 shrink-0" aria-hidden="true" />
                            <span className="break-words">
                              {task.projectId
                                ? projects.find((project) => project.id === task.projectId)?.name || "Project unavailable"
                                : "No project assigned"}
                            </span>
                          </p>

                          {task.dueDate && (
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="size-3" aria-hidden="true" />
                              Due {formatDueDate(task.dueDate)}
                            </p>
                          )}
                        </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {!tasksError && tasks.length > 5 && (
                  <p className="mt-4 text-xs text-muted-foreground">Showing 5 of {tasks.length} open tasks. Open your projects below to manage the rest.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-t-2 border-t-violet-500">
              <CardHeader>
                <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-400">
                  <Users className="size-5" />
                </div>

                <CardTitle className="flex items-center gap-2">Friends <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{friendsData.friends.length}</span></CardTitle>

                <CardDescription>
                  Connect with friends and stay accountable together.
                </CardDescription>

                <CardAction>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={showAddFriend ? "Cancel" : "Add friend"}
                    title={showAddFriend ? "Cancel" : "Add friend"}
                    onClick={() => {
                      setShowAddFriend(!showAddFriend);
                      setFriendMessage("");
                      setFriendError("");
                    }}
                  >
                    {showAddFriend ? <X /> : <Plus />}
                  </Button>
                </CardAction>
              </CardHeader>

              <CardContent className="space-y-4">
                {showAddFriend && (
                  <form onSubmit={handleAddFriend} className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        aria-label="Friend's email"
                        placeholder="Friend's email"
                        value={friendEmail}
                        onChange={(event) => setFriendEmail(event.target.value)}
                        required
                        autoFocus
                      />
                      <Button type="submit">Add</Button>
                    </div>

                    {friendError && (
                      <p role="alert" className="text-sm text-destructive">
                        {friendError}
                      </p>
                    )}
                  </form>
                )}

                {friendMessage && (
                  <p role="status" className="rounded-lg border bg-muted/50 p-3 text-sm text-foreground">
                    {friendMessage}
                  </p>
                )}

                {friendsData.incoming.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      FRIEND REQUESTS
                    </p>

                    <ul className="space-y-2">
                      {friendsData.incoming.map((request) => (
                        <li
                          key={request.id}
                          className="flex items-center justify-between gap-2 rounded-xl border bg-background/40 p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {request.user.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {request.user.email}
                            </p>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              size="icon-sm"
                              aria-label="Accept"
                              title="Accept"
                              onClick={() =>
                                respondToRequest(request.id, "accept")
                              }
                            >
                              <Check />
                            </Button>

                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="Decline"
                              title="Decline"
                              onClick={() =>
                                respondToRequest(request.id, "decline")
                              }
                            >
                              <X />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {friendsData.friends.length > 0 ? (
                  <ul className="space-y-2">
                    {friendsData.friends.map((friend) => (
                      <li key={friend.id} className="min-w-0 rounded-xl border bg-background/40 px-3 py-2.5 transition-colors hover:border-primary/30">
                        <p className="truncate text-sm font-medium">
                          {friend.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {friend.email}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state">
                    <Users className="mb-1 size-7 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                    <p className="font-medium text-foreground">Progress is better together</p>
                    <p>No friends yet. Click + to add someone by email.</p>
                  </div>
                )}

                {friendsData.outgoing.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Pending:{" "}
                    {friendsData.outgoing
                      .map((request) => request.user.name)
                      .join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {location.state?.projectDeleted === true && (
          <Alert role="status" className="mt-8">
            <AlertDescription className="flex items-center justify-between gap-3">
              Project deleted.
              <Button variant="ghost" size="icon-sm" aria-label="Dismiss deletion notice" onClick={() => navigate("/home", { replace: true, state: null })}>
                <X aria-hidden="true" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <section className="mt-8" aria-labelledby="projects-heading">
          <h3 id="projects-heading" className="mb-4 text-lg font-semibold">
            Your projects
          </h3>

          {projectsError ? (
            <Alert variant="destructive">
              <AlertDescription>{projectsError}</AlertDescription>
            </Alert>
          ) : projects.length === 0 ? (
            <div className="empty-state py-10">
              <span className="mb-2 flex size-12 items-center justify-center rounded-2xl border bg-card text-primary"><FolderKanban className="size-6" aria-hidden="true" /></span>
              <p className="text-base font-semibold text-foreground">Every goal starts with a plan</p>
              <p className="max-w-sm">Create your first project to give your ideas, goals, and milestones a place to grow.</p>
              <Link to="/projects/new" className={buttonVariants({ variant: "outline", className: "mt-3" })}><Plus aria-hidden="true" /> Create your first project</Link>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link key={project.id} to={`/projects/${project.id}`} aria-label={`Open project: ${project.name}`} className="group min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Card className="h-full transition-shadow duration-200 group-hover:ring-primary/30 group-hover:shadow-md">
                  <CardHeader>
                    <div className="mb-3 flex items-center justify-between text-primary"><FolderKanban className="size-5" aria-hidden="true" /><ArrowUpRight className="size-4" aria-hidden="true" /></div>
                    <CardTitle className="break-words">
                      {project.name}
                    </CardTitle>

                    {project.owner && project.ownerId !== user.id && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <Users className="size-3.5" aria-hidden="true" /> Shared by {project.owner.name}
                      </p>
                    )}

                    <CardDescription className="whitespace-pre-wrap break-words">
                      {project.description || "No description yet."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {project.goal && (
                      <p className="whitespace-pre-wrap break-words rounded-xl bg-primary/5 p-3 text-sm">
                        <span className="font-medium">Goal: </span>
                        {project.goal}
                      </p>
                    )}

                    <p className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                      <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                      {project.targetDate
                        ? `Target: ${new Date(
                            project.targetDate
                          ).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })}`
                        : "No target date"}
                    </p>
                  </CardContent>
                </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-primary" aria-hidden="true" /> Recent Activity</CardTitle>
              <CardDescription>
                Updates from your projects, tasks, and collaborators will
                appear here.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="empty-state min-h-32">
                <Activity className="size-6 text-primary/60" aria-hidden="true" />
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
