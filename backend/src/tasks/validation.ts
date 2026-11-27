export const TASK_PRIORITIES = ["low", "medium", "high"];

type TaskInput = {
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: string;
};

type ValidationResult =
  | { data: TaskInput; error?: never }
  | { data?: never; error: string };

// Shared by task creation and editing so both accept the same fields.
export function validateTaskInput(body: unknown): ValidationResult {
  const { title, description, dueDate, priority } =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const trimmedTitle = typeof title === "string" ? title.trim() : "";

  if (!trimmedTitle) {
    return { error: "Task title is required" };
  }

  const taskPriority = priority || "medium";

  if (typeof taskPriority !== "string" || !TASK_PRIORITIES.includes(taskPriority)) {
    return { error: "Priority must be low, medium, or high" };
  }

  let taskDueDate: Date | null = null;

  if (dueDate) {
    // The date input sends YYYY-MM-DD; store it as that calendar day in UTC.
    taskDueDate =
      typeof dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
        ? new Date(`${dueDate}T00:00:00.000Z`)
        : new Date(NaN);

    if (
      Number.isNaN(taskDueDate.getTime()) ||
      taskDueDate.toISOString().slice(0, 10) !== dueDate
    ) {
      return { error: "Due date is invalid" };
    }
  }

  const trimmedDescription =
    typeof description === "string" ? description.trim() : "";

  return {
    data: {
      title: trimmedTitle,
      description: trimmedDescription || null,
      dueDate: taskDueDate,
      priority: taskPriority,
    },
  };
}
