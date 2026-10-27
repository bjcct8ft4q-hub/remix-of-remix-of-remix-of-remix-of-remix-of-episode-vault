import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  username: string | null;
  isAdmin: boolean;
  loading: boolean;
  openAuth: (tab?: "signin" | "signup") => void;
  authTab: "signin" | "signup" | null;
  closeAuth: () => void;
};

const Ctx = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authTab, setAuthTab] = useState<"signin" | "signup" | null>(null);

  useEffect(() => {
    const load = async (u: User | null) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setUsername(null);
        setLoading(false);
        return;
      }
      const [{ data: roles }, { data: prof }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.id),
        supabase.from("profiles").select("username").eq("id", u.id).maybeSingle(),
      ]);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      setUsername(prof?.username ?? u.email ?? null);
      setLoading(false);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        setTimeout(() => load(session?.user ?? null), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{ user, username, isAdmin, loading, authTab, openAuth: (t = "signin") => setAuthTab(t), closeAuth: () => setAuthTab(null) }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
