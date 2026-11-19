import { db } from "../prisma/db.js";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function findOwnedProject(projectId: string, userId: string) {
  return db.project.findFirst({
    where: { id: projectId, ownerId: userId },
    select: { id: true },
  });
}

// The owner or any collaborator can open a project and add tasks to it.
export function accessibleProjectWhere(userId: string) {
  return {
    OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }],
  };
}

export function findAccessibleProject(projectId: string, userId: string) {
  return db.project.findFirst({
    where: { id: projectId, ...accessibleProjectWhere(userId) },
    select: { id: true, ownerId: true },
  });
}
