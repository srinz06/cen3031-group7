import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Pencil, UserRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EditNameDialogProps = {
  name: string;
  onNameUpdated: (name: string) => void;
};

export function EditNameDialog({ name, onNameUpdated }: EditNameDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (saving) return;
    if (nextOpen) {
      setDraft(name);
      setError("");
    }
    setOpen(nextOpen);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!draft.trim()) {
      setError("Enter a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("http://localhost:3001/api/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.trim() }),
      });
      if (response.status === 401) {
        navigate("/", { replace: true });
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Unable to update your name. Please try again.");
        return;
      }
      onNameUpdated(data.user.name);
      setOpen(false);
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<button type="button" aria-label="Edit your name" title="Edit your name" />}
        className="group relative flex size-10 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary outline-none transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserRound className="size-5" aria-hidden="true" />
        <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border bg-background text-muted-foreground group-hover:text-primary" aria-hidden="true">
          <Pencil className="size-2.5" />
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>Edit your name</DialogTitle>
          <DialogDescription>This is the name your friends and collaborators see.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} onChange={() => setError("")} className="space-y-5">
          <fieldset disabled={saving} className="space-y-2">
            <Label htmlFor="edit-user-name">Name</Label>
            <Input id="edit-user-name" value={draft} onChange={(event) => setDraft(event.target.value)} required maxLength={100} autoFocus />
          </fieldset>
          {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={saving} />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save name"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
