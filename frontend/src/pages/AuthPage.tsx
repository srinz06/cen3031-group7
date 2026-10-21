import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";

export function AuthPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold tracking-tight">Goal Sync</h1>

          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Organize projects, track progress, and stay accountable with your
            team and friends.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <RegisterForm />
          <LoginForm />
        </div>
      </div>
    </main>
  );
}