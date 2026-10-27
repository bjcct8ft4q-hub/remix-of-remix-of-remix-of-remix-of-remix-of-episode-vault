import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/anilist-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin.from("import_settings").select("enabled").eq("id", true).maybeSingle();
        if (!settings?.enabled) return Response.json({ skipped: "automatic updates are off" });
        const { importCore } = await import("@/lib/anilist.server");
        try {
          const trending = await importCore({ selection: "trending" });
          return Response.json({ success: true, trending });
        } catch (e) {
          return Response.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
        }
      },
    },
  },
});
