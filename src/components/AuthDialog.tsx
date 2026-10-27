import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-muted/60 px-3.5 py-3 text-sm outline-none transition focus:border-primary";

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder="••••••••" className={inputCls} autoComplete="current-password" required />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AuthDialog() {
  const { authTab, closeAuth, openAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  if (!authTab) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      toast.success("Welcome back!");
      closeAuth();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 p-4 backdrop-blur-sm" onClick={closeAuth}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-lg border border-border border-t-primary bg-card p-7 shadow-2xl"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-primary/20" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full border border-primary/20" />
        <button onClick={closeAuth} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        {authTab === "signup" ? (
          <>
            <h2 className="text-2xl font-extrabold">Account creation is temporarily unavailable</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              We’re carrying out maintenance on Streamly account registration. You can still sign in if you already have an account.
              Please check back for updates on when new registrations will reopen.
            </p>
            <button
              type="button"
              onClick={() => openAuth("signin")}
              className="mt-6 w-full rounded-sm bg-primary py-3.5 text-sm font-extrabold uppercase tracking-[0.2em] text-primary-foreground"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-extrabold">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your existing Streamly account.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} autoComplete="username" required />
              </Field>
              <Field label="Password">
                <PasswordInput value={password} onChange={setPassword} />
              </Field>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-sm bg-primary py-3.5 text-sm font-extrabold uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Please wait..." : "Sign in"}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">New account registration is temporarily unavailable.</p>
          </>
        )}
      </div>
    </div>
  );
}
