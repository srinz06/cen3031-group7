import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, CalendarDays, Check, Circle, FolderKanban, ListTodo, LoaderCircle, Target, TrendingUp } from "lucide-react";
import { GoalSyncBrand } from "@/components/GoalSyncBrand";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { ProjectCollaborators } from "@/components/projects/ProjectCollaborators";
import { CreateTaskDialog, type Task } from "@/components/tasks/CreateTaskDialog";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project, ProjectMember } from "@/types/project";

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});

export function ProjectPage() {
  const { projectId } = useParams();
  return <ProjectWorkspace key={projectId} projectId={projectId} />;
}

function ProjectWorkspace({ projectId }: { projectId: string | undefined }) {
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [viewerId, setViewerId] = useState("");
  const [owner, setOwner] = useState<ProjectMember | null>(null);
  const [collaborators, setCollaborators] = useState<ProjectMember[]>([]);
  const [projectSaved, setProjectSaved] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const loadWorkspace = async () => {
      setLoading(true);
      setPageError("");
      setNotFound(false);
      setTasksError("");
      try {
        if (!projectId) {
          setNotFound(true);
          return;
        }
        const response = await fetch(`http://localhost:3001/api/projects/${encodeURIComponent(projectId)}`, {
          credentials: "include", signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          navigate("/", { replace: true });
          return;
        }
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) {
          setPageError("Unable to load this project. Please try again.");
          return;
        }
        const data = await response.json();
        if (controller.signal.aborted) return;
        setProject(data.project);
        setIsOwner(data.isOwner);
        setViewerId(data.viewerId);
        setOwner(data.owner);
        setCollaborators(data.collaborators);

        try {
          const tasksResponse = await fetch(`http://localhost:3001/api/tasks?projectId=${encodeURIComponent(projectId)}&includeCompleted=true`, {
            credentials: "include", signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          if (tasksResponse.status === 401) {
            navigate("/", { replace: true });
            return;
          }
          if (tasksResponse.status === 404) {
            setNotFound(true);
            return;
          }
          if (!tasksResponse.ok) {
            setTasksError("Unable to load this project's tasks. Please try again.");
            return;
          }
          const tasksData = await tasksResponse.json();
          if (!controller.signal.aborted) setTasks(tasksData.tasks);
        } catch {
          if (!controller.signal.aborted) setTasksError("Unable to connect to the server to load tasks.");
        }
      } catch {
        if (!controller.signal.aborted) setPageError("Unable to connect to the server. Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadWorkspace();
    return () => controller.abort();
  }, [projectId, navigate, loadAttempt]);

  const handleTaskStatus = async (task: Task, status: "todo" | "complete") => {
    if (updatingIds.includes(task.id)) return;
    setUpdatingIds((current) => [...current, task.id]);
    setActionError("");
    setNotice("");
    try {
      const response = await fetch(`http://localhost:3001/api/tasks/${task.id}/status`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.status === 401) {
        navigate("/", { replace: true });
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        setActionError(data.message || "Unable to update this task's status. Please try again.");
        return;
      }
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...data.task } : item));
      setNotice(`${status === "complete" ? "Completed" : "Moved to to do"}: ${task.title}`);
    } catch {
      setActionError("Unable to connect to the server to update this task's status.");
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== task.id));
    }
  };

  // Progress counts every task in the project, from all members.
  const completedCount = tasks.filter((task) => task.completedAt).length;
  const progressPercent = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <Link to="/home" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"><GoalSyncBrand /></Link>
          <Link to="/home" className={buttonVariants({ variant: "ghost" })}><ArrowLeft aria-hidden="true" /> Back to dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
        {loading ? (
          <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> Loading your project...
          </div>
        ) : notFound ? (
          <section className="empty-state min-h-64">
            <FolderKanban className="mb-2 size-9 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-foreground">Project not found</h1>
            <p>This project may no longer exist, or you may not have access to it.</p>
            <Link to="/home" className={buttonVariants({ className: "mt-3" })}>Return to dashboard</Link>
          </section>
        ) : pageError || !project ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-semibold">Unable to open project</h1>
            <Alert variant="destructive" role="alert"><AlertDescription>{pageError || "Please try loading the project again."}</AlertDescription></Alert>
            <Button variant="outline" onClick={() => setLoadAttempt((current) => current + 1)}>Try again</Button>
          </section>
        ) : (
          <>
            <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link to="/home" className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">Dashboard</Link>
              <span aria-hidden="true">/</span><span className="break-words text-foreground">{project.name}</span>
            </nav>

            <section className="workspace-banner mb-8 rounded-2xl border bg-card p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary"><FolderKanban className="size-4" aria-hidden="true" /> PROJECT WORKSPACE</p>
                {isOwner ? (
                  <EditProjectDialog project={project} onProjectUpdated={(updated) => {
                    setProject(updated);
                    setProjectSaved(true);
                  }} />
                ) : owner && (
                  <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Shared by {owner.name}</span>
                )}
              </div>
              <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1>
              <p className="mt-4 max-w-3xl whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">{project.description || "No description yet."}</p>
              {projectSaved && <p role="status" className="mt-4 text-sm font-medium text-primary">Project changes saved.</p>}
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section aria-labelledby="project-tasks-heading" className="min-w-0">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <CardTitle><h2 id="project-tasks-heading" className="flex items-center gap-2"><ListTodo className="size-5 text-primary" aria-hidden="true" /> Tasks {!tasksError && <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{tasks.length}</span>}</h2></CardTitle>
                      <CreateTaskDialog projectId={project.id} onTaskCreated={(task) => {
                        setTasks((current) => [{ ...task, user: { id: viewerId, name: "" } }, ...current]);
                        setNotice(`Created: ${task.title}`);
                        setActionError("");
                      }} />
                    </div>
                    <CardDescription>Manage your next steps. Switch completed tasks back to To do whenever needed.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {actionError && <Alert variant="destructive" role="alert"><AlertDescription>{actionError}</AlertDescription></Alert>}
                    {notice && <p role="status" className="break-words rounded-lg bg-primary/5 p-3 text-sm text-primary">{notice}</p>}
                    {tasksError ? (
                      <div className="space-y-3">
                        <Alert variant="destructive" role="alert"><AlertDescription>{tasksError}</AlertDescription></Alert>
                        <Button variant="outline" onClick={() => setLoadAttempt((current) => current + 1)}>Try again</Button>
                      </div>
                    ) : tasks.length === 0 ? (
                      <div className="empty-state min-h-48">
                        <ListTodo className="mb-2 size-8 text-primary" aria-hidden="true" />
                        <p className="font-semibold text-foreground">Ready for your next step</p>
                        <p>No tasks in this project. Use Create task to add one.</p>
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {tasks.map((task) => (
                          <li key={task.id} className="flex items-start gap-3 rounded-xl border bg-background/40 p-4">
                            <span className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full ${task.completedAt ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} aria-hidden="true">
                              {updatingIds.includes(task.id) ? <LoaderCircle className="size-4 animate-spin" /> : task.completedAt ? <Check className="size-4" /> : <Circle className="size-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className={`min-w-0 break-words font-medium ${task.completedAt ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
                                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs capitalize ${task.priority === "high" ? "bg-destructive/10 text-destructive" : task.priority === "medium" ? "bg-amber-500/10 text-amber-800 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>{task.priority}</span>
                              </div>
                              {task.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{task.description}</p>}
                              {task.dueDate && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5 shrink-0" aria-hidden="true" /> Due {formatDate(task.dueDate)}</p>}
                              {collaborators.length > 0 && task.user && (
                                <p className="mt-2 text-xs text-muted-foreground">Added by {task.userId === viewerId ? "you" : task.user.name}</p>
                              )}
                              {task.userId !== viewerId ? (
                                <p className="mt-3 text-xs text-muted-foreground">Status: {task.completedAt ? "Complete" : "To do"}</p>
                              ) : (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <label htmlFor={`task-status-${task.id}`} className="text-xs font-medium text-muted-foreground">Status</label>
                                <select
                                  id={`task-status-${task.id}`}
                                  aria-label={`Status for ${task.title}`}
                                  value={task.completedAt ? "complete" : "todo"}
                                  disabled={updatingIds.includes(task.id)}
                                  onChange={(event) => handleTaskStatus(task, event.target.value as "todo" | "complete")}
                                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-50"
                                >
                                  <option value="todo">To do</option>
                                  <option value="complete">Complete</option>
                                </select>
                                <EditTaskDialog task={task} onTaskUpdated={(updated) => {
                                  setTasks((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
                                  setNotice(`Updated: ${updated.title}`);
                                  setActionError("");
                                }} />
                              </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </section>

              <aside aria-label="Project details" className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Project details</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h2 id="project-progress-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold"><TrendingUp className="size-4 text-primary" aria-hidden="true" /> Progress</h2>
                      {tasksError ? (
                        <p className="text-sm text-muted-foreground">Progress is unavailable until tasks load.</p>
                      ) : tasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Add tasks to start tracking progress.</p>
                      ) : (
                        <>
                          <div
                            role="progressbar"
                            aria-labelledby="project-progress-heading"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progressPercent}
                            aria-valuetext={`${completedCount} of ${tasks.length} tasks complete`}
                            className="h-2 overflow-hidden rounded-full bg-muted"
                          >
                            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
                          </div>
                          <p className="mt-2 flex justify-between gap-2 text-sm text-muted-foreground">
                            <span>{completedCount} of {tasks.length} {tasks.length === 1 ? "task" : "tasks"} complete</span>
                            <span className="font-medium tabular-nums text-foreground">{progressPercent}%</span>
                          </p>
                        </>
                      )}
                    </div>
                    <div className="border-t pt-5">
                      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Target className="size-4 text-primary" aria-hidden="true" /> Goal</h2>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{project.goal || "No goal set yet."}</p>
                    </div>
                    <div className="border-t pt-5">
                      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-primary" aria-hidden="true" /> Target date</h2>
                      <p className="text-sm text-muted-foreground">{project.targetDate ? formatDate(project.targetDate) : "No target date set."}</p>
                    </div>
                  </CardContent>
                </Card>
                {owner && (
                  <div className="mt-6">
                    <ProjectCollaborators
                      projectId={project.id}
                      isOwner={isOwner}
                      viewerId={viewerId}
                      owner={owner}
                      collaborators={collaborators}
                      onCollaboratorsChange={setCollaborators}
                      onLeft={() => navigate("/home", { replace: true })}
                    />
                  </div>
                )}
                {isOwner && (
                  <Card className="mt-6 border-destructive/30">
                    <CardHeader>
                      <CardTitle>Delete project</CardTitle>
                      <CardDescription>Permanently remove this project and all its tasks.</CardDescription>
                    </CardHeader>
                    <CardContent><DeleteProjectDialog project={project} /></CardContent>
                  </Card>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
