import { useState } from "react";
import { Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { TaskFormFields, type TaskFormValues, type TaskPriority } from "@/components/tasks/TaskFormFields";

export type { TaskPriority };

export type Task = {
  id: string;
  createdAt: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  completedAt: string | null;
  userId: string;
  projectId: string;
  user?: { id: string; name: string };
};

type CreateTaskDialogProps = {
  projectId: string;
  onTaskCreated: (task: Task) => void;
};

const emptyTask: TaskFormValues = { title: "", description: "", dueDate: "", priority: "medium" };

export function CreateTaskDialog({ projectId, onTaskCreated }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<TaskFormValues>(emptyTask);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setValues(emptyTask);
    setMessage("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      resetForm();
    }
  };

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();

    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("http://localhost:3001/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...values,
          dueDate: values.dueDate || null,
          projectId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message);
        return;
      }

      onTaskCreated(data.task);
      handleOpenChange(false);
    } catch (error) {
      console.error(error);
      setMessage("Unable to connect to the server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button />
        }
      >
        <Plus aria-hidden="true" /> Create task
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Add a task to this project to keep your next steps organized.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateTask} className="space-y-4">
          <TaskFormFields idPrefix="task" values={values} onChange={setValues} />

          {message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
