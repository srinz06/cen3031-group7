import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Project } from "@/types/project";

export function DeleteProjectDialog({ project }: { project: Project }) {
  const navigate = useNavigate();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deletingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (deletingRef.current) return;
    setError("");
    setOpen(nextOpen);
  };

  const handleDelete = async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setError("");

    try {
      const response = await fetch(`http://localhost:3001/api/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.status === 401) {
        navigate("/", { replace: true });
        return;
      }
      if (!response.ok) {
        setError(response.status === 404
          ? "This project no longer exists or you no longer have access. Return to the dashboard to refresh your projects."
          : "Unable to delete project. Please try again.");
        return;
      }
      navigate("/home", { replace: true, state: { projectDeleted: true } });
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="destructive" />}>
        <Trash2 aria-hidden="true" /> Delete project
      </DialogTrigger>
      <DialogContent initialFocus={cancelRef} showCloseButton={!deleting}>
        <DialogHeader>
          <DialogTitle className="break-words leading-snug">Delete “{project.name}”?</DialogTitle>
          <DialogDescription>
            This permanently deletes the project and all its tasks. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <DialogClose render={<Button ref={cancelRef} type="button" variant="outline" disabled={deleting} />}>Cancel</DialogClose>
          <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Deleting..." : "Delete project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
