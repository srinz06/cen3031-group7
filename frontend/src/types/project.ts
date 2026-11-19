export type Project = {
  id: string;
  name: string;
  description: string;
  goal: string;
  targetDate: string | null;
  ownerId?: string;
  owner?: { id: string; name: string };
};

export type ProjectMember = {
  id: string;
  name: string;
  email: string;
};
