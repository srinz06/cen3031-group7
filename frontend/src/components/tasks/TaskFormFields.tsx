import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type TaskPriority = "low" | "medium" | "high";

export type TaskFormValues = {
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
};

type TaskFormFieldsProps = {
  idPrefix: string;
  values: TaskFormValues;
  onChange: (values: TaskFormValues) => void;
};

// The task fields shared by the create and edit dialogs.
export function TaskFormFields({ idPrefix, values, onChange }: TaskFormFieldsProps) {
  const update = (changes: Partial<TaskFormValues>) => onChange({ ...values, ...changes });

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          type="text"
          placeholder="What needs to be done?"
          value={values.title}
          onChange={(event) => update({ title: event.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          placeholder="Add any details (optional)"
          value={values.description}
          onChange={(event) => update({ description: event.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-due-date`}>Due date</Label>
          <Input
            id={`${idPrefix}-due-date`}
            type="date"
            value={values.dueDate}
            onChange={(event) => update({ dueDate: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-priority`}>Priority</Label>
          <select
            id={`${idPrefix}-priority`}
            value={values.priority}
            onChange={(event) => update({ priority: event.target.value as TaskPriority })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
    </>
  );
}
