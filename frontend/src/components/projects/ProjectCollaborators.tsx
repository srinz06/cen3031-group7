import { useEffect, useState, type FormEvent } from "react";
import { Crown, LoaderCircle, LogOut, UserPlus, Users, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectMember } from "@/types/project";

type ProjectCollaboratorsProps = {
  projectId: string;
  isOwner: boolean;
  viewerId: string;
  owner: ProjectMember;
  collaborators: ProjectMember[];
  onCollaboratorsChange: (collaborators: ProjectMember[]) => void;
  onLeft: () => void;
};

export function ProjectCollaborators({
  projectId, isOwner, viewerId, owner, collaborators, onCollaboratorsChange, onLeft,
}: ProjectCollaboratorsProps) {
  const [friends, setFriends] = useState<ProjectMember[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isOwner) return;
    const controller = new AbortController();
    fetch("http://localhost:3001/api/friends", { credentials: "include", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) setFriends(data.friends); })
      .catch(() => {});
    return () => controller.abort();
  }, [isOwner]);

  const availableFriends = friends.filter(
    (friend) => !collaborators.some((collaborator) => collaborator.id === friend.id)
  );

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || busyId) return;
    setBusyId(selectedId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/collaborators`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Unable to add collaborator.");
        return;
      }
      onCollaboratorsChange([...collaborators, data.collaborator]);
      setNotice(data.message);
      setSelectedId("");
    } catch {
      setError("Unable to connect to the server to add a collaborator.");
    } finally {
      setBusyId("");
    }
  };

  const handleRemove = async (member: ProjectMember) => {
    if (busyId) return;
    const leaving = member.id === viewerId;
    if (leaving && !window.confirm("Leave this project? You'll lose access until the owner adds you again.")) return;
    setBusyId(member.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/collaborators/${member.id}`, {
        method: "DELETE", credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Unable to remove collaborator.");
        return;
      }
      if (leaving) {
        onLeft();
        return;
      }
      onCollaboratorsChange(collaborators.filter((collaborator) => collaborator.id !== member.id));
      setNotice(data.message);
    } catch {
      setError("Unable to connect to the server to update collaborators.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="size-4 text-primary" aria-hidden="true" /> Collaborators</CardTitle>
        <CardDescription>
          {isOwner ? "Add friends to work on this project with you." : "People working on this project."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
        {notice && <p role="status" className="rounded-lg bg-primary/5 p-3 text-sm text-primary">{notice}</p>}

        <ul className="space-y-3">
          <li className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{owner.name}{owner.id === viewerId && " (you)"}</p>
              <p className="truncate text-xs text-muted-foreground">{owner.email}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"><Crown className="size-3" aria-hidden="true" /> Owner</span>
          </li>
          {collaborators.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.name}{member.id === viewerId && " (you)"}</p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
              {isOwner && (
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.name}`} title="Remove" disabled={Boolean(busyId)} onClick={() => handleRemove(member)}>
                  {busyId === member.id ? <LoaderCircle className="animate-spin" /> : <X />}
                </Button>
              )}
            </li>
          ))}
        </ul>

        {isOwner ? (
          friends.length === 0 ? (
            <p className="border-t pt-4 text-xs text-muted-foreground">Add friends from your dashboard to invite them here.</p>
          ) : availableFriends.length === 0 ? (
            <p className="border-t pt-4 text-xs text-muted-foreground">All your friends are already collaborators.</p>
          ) : (
            <form onSubmit={handleAdd} className="flex gap-2 border-t pt-4">
              <select
                aria-label="Friend to add"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Choose a friend</option>
                {availableFriends.map((friend) => <option key={friend.id} value={friend.id}>{friend.name}</option>)}
              </select>
              <Button type="submit" disabled={!selectedId || Boolean(busyId)}>
                <UserPlus aria-hidden="true" /> Add
              </Button>
            </form>
          )
        ) : (
          <Button variant="outline" className="w-full" disabled={Boolean(busyId)} onClick={() => handleRemove({ id: viewerId, name: "", email: "" })}>
            <LogOut aria-hidden="true" /> Leave project
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
