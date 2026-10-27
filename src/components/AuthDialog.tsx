import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  username: z.string().trim().min(3, "Username needs 3+ characters").max(30),
  password: z.string().min(8, "Password needs 8+ characters").max(72),
});

function Field({ label, children, extra }: { label: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        {extra}
      </div>
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
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder="••••••••" className={inputCls} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AuthDialog() {
  const { authTab, closeAuth, openAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  if (!authTab) return null;
  const signup = authTab === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (signup) {
        const parsed = signupSchema.safeParse({ email, username, password });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
        if (password !== confirm) throw new Error("Passwords don't match");
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { username: parsed.data.username } },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
        closeAuth();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Welcome back!");
        closeAuth();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message);
    else if (!r.redirected) closeAuth();
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
        <h2 className="text-2xl font-extrabold">{signup ? "Join Streamly" : "Welcome back"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{signup ? "Start your watch journey today." : "Sign in to continue your journey."}</p>
        <div className="mt-5 flex gap-6 border-b border-border text-sm font-semibold">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => openAuth(t)}
              className={`-mb-px border-b-2 pb-2 ${authTab === t ? "border-primary text-primary" : "border-transparent text-foreground"}`}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
          </Field>
          {signup && (
            <Field label="Username">
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="coolwatcher42" className={inputCls} />
            </Field>
          )}
          <Field label="Password">
            <PasswordInput value={password} onChange={setPassword} />
          </Field>
          {signup && (
            <Field label="Confirm password">
              <PasswordInput value={confirm} onChange={setConfirm} />
            </Field>
          )}
          <button
            disabled={busy}
            className="w-full rounded-sm bg-primary py-3.5 text-sm font-extrabold uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Please wait..." : signup ? "Create account" : "Sign in"}
          </button>
        </form>
        <button onClick={google} className="mt-3 w-full rounded-sm border border-border py-3 text-sm font-semibold hover:bg-muted">
          Continue with Google
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {signup ? "Already have an account? " : "Don't have an account? "}
          <button onClick={() => openAuth(signup ? "signin" : "signup")} className="font-semibold text-primary">
            {signup ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
