type ProjectInput = {
  name: string;
  description: string;
  goal: string;
  targetDate: Date | null;
};

type ValidationResult =
  | { data: ProjectInput; error?: never }
  | { data?: never; error: string };

export function validateProjectInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Project details are required." };
  }

  const { name, description = "", goal = "", targetDate } = body as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    return { error: "Project name must contain 1 to 100 characters." };
  }

  if (typeof description !== "string" || description.trim().length > 2000) {
    return { error: "Description must contain at most 2,000 characters." };
  }

  if (typeof goal !== "string" || goal.trim().length > 2000) {
    return { error: "Goal must contain at most 2,000 characters." };
  }

  let parsedDate: Date | null = null;

  if (targetDate !== undefined && targetDate !== null && targetDate !== "") {
    if (typeof targetDate !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return { error: "Target date must be a valid date in YYYY-MM-DD format." };
    }

    parsedDate = new Date(`${targetDate}T00:00:00.000Z`);

    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== targetDate) {
      return { error: "Target date must be a valid calendar date." };
    }
  }

  return {
    data: {
      name: name.trim(),
      description: description.trim(),
      goal: goal.trim(),
      targetDate: parsedDate,
    },
  };
}
