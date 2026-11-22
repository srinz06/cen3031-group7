import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Check, LoaderCircle, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import { GoalSyncBrand } from "@/components/GoalSyncBrand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Friend, FriendsData } from "@/types/friends";

export function FriendsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<FriendsData>({ friends: [], incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [removing, setRemoving] = useState<Friend | null>(null);

  const loadFriends = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("http://localhost:3001/api/friends", { credentials: "include", signal });
      if (signal?.aborted) return;
      if (response.status === 401) {
        navigate("/", { replace: true });
        return;
      }
      if (!response.ok) {
        setLoadError("Unable to load friends. Please try again.");
        return;
      }
      const friends = await response.json();
      if (!signal?.aborted) {
        setData(friends);
        setLoadError("");
      }
    } catch {
      if (!signal?.aborted) setLoadError("Unable to connect to the server to load friends.");
    }
  }, [navigate]);

  useEffect(() => {
    const controller = new AbortController();
    loadFriends(controller.signal).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [loadFriends]);

  const performAction = async (key: string, url: string, options: RequestInit, onSuccess?: () => void) => {
    if (busy) return;
    setBusy(key);
    setActionError("");
    setNotice("");
    try {
      const response = await fetch(url, { ...options, credentials: "include" });
      if (response.status === 401) {
        navigate("/", { replace: true });
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        setActionError(result.message || "Unable to update friends. Please try again.");
        return;
      }
      onSuccess?.();
      setNotice(result.message || "Friends updated.");
      await loadFriends();
    } catch {
      setActionError("Unable to connect to the server. Please try again.");
    } finally {
      setBusy("");
    }
  };

  const sendRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void performAction("send", "http://localhost:3001/api/friends/requests", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    }, () => setEmail(""));
  };

  const respondToRequest = (id: string, action: "accept" | "decline") => {
    void performAction(id, `http://localhost:3001/api/friends/requests/${id}/${action}`, { method: "POST" });
  };

  const removeFriend = () => {
    if (!removing) return;
    const friend = removing;
    void performAction("remove", `http://localhost:3001/api/friends/${encodeURIComponent(friend.id)}`, { method: "DELETE" }, () => {
      setData((current) => ({ ...current, friends: current.friends.filter((item) => item.id !== friend.id) }));
      setRemoving(null);
    });
  };

  const query = search.trim().toLowerCase();
  const friends = data.friends.filter((friend) => `${friend.name} ${friend.email}`.toLowerCase().includes(query));
  const disabled = Boolean(busy) || Boolean(loadError);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <Link to="/home" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"><GoalSyncBrand /></Link>
          <Link to="/home" className={buttonVariants({ variant: "ghost" })}><ArrowLeft aria-hidden="true" /> Back to dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
        <section className="workspace-banner mb-8 rounded-2xl border bg-card p-6 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary"><Users className="size-4" aria-hidden="true" /> YOUR CONNECTIONS</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Friends</h1>
          <p className="mt-3 text-muted-foreground">Connect with friends and stay accountable together.</p>
        </section>

        {loading ? (
          <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> Loading friends...</div>
        ) : (
          <>
            {loadError && <div className="mb-6 space-y-3"><Alert variant="destructive" role="alert"><AlertDescription>{loadError}</AlertDescription></Alert><Button variant="outline" disabled={Boolean(busy)} onClick={() => void loadFriends()}>Try again</Button></div>}
            {actionError && !removing && <Alert variant="destructive" role="alert" className="mb-6"><AlertDescription>{actionError}</AlertDescription></Alert>}
            {notice && <p role="status" className="mb-6 break-words rounded-lg border border-primary/15 bg-primary/5 p-4 text-sm text-primary">{notice}</p>}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <section aria-labelledby="friends-heading" className="min-w-0">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <CardTitle><h2 id="friends-heading" className="flex items-center gap-2">Your friends <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs tabular-nums text-primary">{data.friends.length}</span></h2></CardTitle>
                      <div className="flex w-full items-center gap-2 rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:w-64">
                        <Search className="pointer-events-none ml-4 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <label htmlFor="friends-search" className="sr-only">Search friends by name or email</label>
                        <Input id="friends-search" className="h-10 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
                      </div>
                    </div>
                    <CardDescription>Newest friendships first.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadError ? <p className="text-sm text-muted-foreground">Your friends list is unavailable until it can be refreshed.</p> : data.friends.length === 0 ? (
                      <div className="empty-state min-h-48"><Users className="mb-2 size-8 text-primary" aria-hidden="true" /><p className="font-semibold text-foreground">Progress is better together</p><p>No friends yet. Send a request using a friend's email to get started.</p></div>
                    ) : friends.length === 0 ? (
                      <div className="empty-state min-h-40"><Search className="size-7 text-primary" aria-hidden="true" /><p className="font-medium text-foreground">No matching friends</p><p>Try a different name or email.</p></div>
                    ) : (
                      <ul className="space-y-3">
                        {friends.map((friend) => (
                          <li key={friend.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/40 px-4 py-3 transition-colors hover:border-primary/30">
                            <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{friend.name}</p><p className="break-words text-xs text-muted-foreground">{friend.email}</p></div>
                            <Button variant="destructive" size="sm" disabled={disabled} aria-label={`Remove ${friend.name} as a friend`} onClick={() => { setActionError(""); setRemoving(friend); }}><UserMinus aria-hidden="true" /> Remove</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {query && !loadError && <p className="text-xs text-muted-foreground">Showing {friends.length} of {data.friends.length} friends</p>}
                  </CardContent>
                </Card>
              </section>

              <div className="min-w-0 space-y-6">
                <Card>
                  <CardHeader><CardTitle><h2 className="flex items-center gap-2"><UserPlus className="size-4 text-primary" aria-hidden="true" /> Add a friend</h2></CardTitle><CardDescription>Send a request using their Goal Sync email address.</CardDescription></CardHeader>
                  <CardContent>
                    <form onSubmit={sendRequest} className="space-y-3">
                      <Label htmlFor="friend-email">Friend's email</Label>
                      <Input id="friend-email" type="email" placeholder="friend@example.com" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={disabled} />
                      <Button type="submit" disabled={disabled}><UserPlus aria-hidden="true" /> {busy === "send" ? "Sending..." : "Send request"}</Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle><h2>Incoming requests <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{data.incoming.length}</span></h2></CardTitle><CardDescription>Accept a request to add someone to your friends.</CardDescription></CardHeader>
                  <CardContent>
                    {loadError ? <p className="text-sm text-muted-foreground">Requests are unavailable until refreshed.</p> : data.incoming.length === 0 ? <p className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">No incoming requests. You're all caught up.</p> : (
                      <ul className="space-y-3">{data.incoming.map((request) => (
                        <li key={request.id} className="space-y-3 rounded-xl border bg-background/40 p-3">
                          <div><p className="break-words text-sm font-medium">{request.user.name}</p><p className="break-words text-xs text-muted-foreground">{request.user.email}</p></div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" disabled={disabled} aria-label={`Accept friend request from ${request.user.name}`} onClick={() => respondToRequest(request.id, "accept")}><Check aria-hidden="true" /> Accept</Button>
                            <Button variant="outline" size="sm" disabled={disabled} aria-label={`Decline friend request from ${request.user.name}`} onClick={() => respondToRequest(request.id, "decline")}><X aria-hidden="true" /> Decline</Button>
                          </div>
                        </li>
                      ))}</ul>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle><h2>Sent requests <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{data.outgoing.length}</span></h2></CardTitle><CardDescription>Waiting for your friends to respond.</CardDescription></CardHeader>
                  <CardContent>
                    {loadError ? <p className="text-sm text-muted-foreground">Requests are unavailable until refreshed.</p> : data.outgoing.length === 0 ? <p className="text-sm text-muted-foreground">No pending sent requests.</p> : <ul className="space-y-2">{data.outgoing.map((request) => <li key={request.id} className="rounded-xl border bg-background/40 p-3"><p className="break-words text-sm font-medium">{request.user.name}</p><p className="break-words text-xs text-muted-foreground">{request.user.email}</p><p className="mt-1 text-xs text-muted-foreground">Pending</p></li>)}</ul>}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={Boolean(removing)} onOpenChange={(open) => { if (!open && !busy) { setRemoving(null); setActionError(""); } }}>
        <DialogContent showCloseButton={!busy}>
          <DialogHeader><DialogTitle>Remove friend?</DialogTitle><DialogDescription>Remove {removing?.name} from your friends? This removes your friendship for both of you. Your accounts and project collaborations will stay unchanged.</DialogDescription></DialogHeader>
          {actionError && <Alert variant="destructive" role="alert"><AlertDescription>{actionError}</AlertDescription></Alert>}
          <DialogFooter><DialogClose render={<Button variant="outline" disabled={Boolean(busy)} />}>Cancel</DialogClose><Button variant="destructive" disabled={Boolean(busy)} onClick={removeFriend}><UserMinus aria-hidden="true" /> {busy === "remove" ? "Removing..." : "Remove friend"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
