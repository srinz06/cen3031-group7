import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Task } from "@/components/tasks/CreateTaskDialog";
import { TaskFormFields, type TaskFormValues } from "@/components/tasks/TaskFormFields";

type EditTaskDialogProps = {
  task: Task;
  onTaskUpdated: (task: Task) => void;
};

const toFormValues = (task: Task): TaskFormValues => ({
  title: task.title,
  description: task.description ?? "",
  dueDate: task.dueDate?.slice(0, 10) ?? "",
  priority: task.priority,
});

export function EditTaskDialog({ task, onTaskUpdated }: EditTaskDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<TaskFormValues>(() => toFormValues(task));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (saving) return;
    if (nextOpen) {
      setValues(toFormValues(task));
      setError("");
    }
    setOpen(nextOpen);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!values.title.trim()) {
      setError("Enter a task title.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`http://localhost:3001/api/tasks/${encodeURIComponent(task.id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, dueDate: values.dueDate || null }),
      });
      if (response.status === 401) {
        navigate("/", { replace: true });
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Unable to update this task. Please try again.");
        return;
      }
      onTaskUpdated(data.task);
      setOpen(false);
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Edit ${task.title}`} />}>
        <Pencil aria-hidden="true" /> Edit
      </DialogTrigger>
      <DialogContent showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update this task's details. It stays in this project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} onChange={() => setError("")} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4">
            <TaskFormFields idPrefix={`edit-task-${task.id}`} values={values} onChange={setValues} />
          </fieldset>
          {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={saving} />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
