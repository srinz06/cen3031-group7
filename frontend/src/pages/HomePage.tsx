import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  Check,
  FolderKanban,
  ListTodo,
  Plus,
  Users,
  UserRound,
  X,
} from "lucide-react";

import {
  CreateTaskDialog,
  type Task,
} from "@/components/tasks/CreateTaskDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
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

  const handleAddFriend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFriendError("");

    try {
      const response = await fetch(
        "http://localhost:3001/api/friends/requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: friendEmail }),
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
        loadFriends();

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
                        placeholder="Friend's email"
                        value={friendEmail}
                        onChange={(event) => setFriendEmail(event.target.value)}
                        required
                        autoFocus
                      />
                      <Button type="submit">Add</Button>
                    </div>

                    {friendError && (
                      <p className="text-sm text-destructive">{friendError}</p>
                    )}
                  </form>
                )}

                {friendMessage && (
                  <p className="text-sm text-muted-foreground">
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
                          className="flex items-center justify-between gap-2"
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
                      <li key={friend.id} className="min-w-0">
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
                  <p className="text-sm text-muted-foreground">
                    No friends yet. Click + to add someone by email.
                  </p>
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