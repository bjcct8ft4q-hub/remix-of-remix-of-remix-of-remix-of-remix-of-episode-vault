import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const runAniListImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ selection: z.enum(["trending", "popular", "upcoming", "airing", "specific"]), anilistId: z.number().int().positive().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { importCore } = await import("@/lib/anilist.server");
    return importCore(data, context.supabase);
  });

export const importStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const c = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
    const [imported, catalog, released, playable, airing, settings, runs] = await Promise.all([
      c(sb.from("series").select("id", { count: "exact", head: true }).not("anilist_id", "is", null)),
      c(sb.from("episode_catalog").select("id", { count: "exact", head: true })),
      c(sb.from("episode_catalog").select("id", { count: "exact", head: true }).eq("released", true)),
      c(sb.from("episodes").select("id", { count: "exact", head: true })),
      c(sb.from("series").select("id", { count: "exact", head: true }).not("anilist_id", "is", null).eq("status", "Airing")),
      sb.from("import_settings").select("enabled, last_success_at").eq("id", true).maybeSingle().then((r) => r.data),
      sb.from("import_runs").select("*").order("started_at", { ascending: false }).limit(10).then((r) => r.data ?? []),
    ]);
    return { imported, catalog, released, playable, airing, settings, runs };
  });
