import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { importStats, runAniListImport } from "@/lib/anilist.functions";
import { Button } from "@/components/ui/button";

export function ImportPanel() {
  const qc = useQueryClient();
  const { data: s, refetch } = useQuery({ queryKey: ["import-stats"], queryFn: () => importStats() });
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState(false);

  const run = async (selection: "trending" | "popular" | "upcoming" | "airing") => {
    setBusy(selection);
    try {
      const r = await runAniListImport({ data: { selection } });
      toast.success(`Checked ${r.processed} anime: ${r.seriesAdded} new, ${r.episodesAdded} episodes added`);
      qc.invalidateQueries({ queryKey: ["series"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(null); void refetch(); }
  };
  const runAll = async () => {
    const selections = ["trending", "popular", "upcoming", "airing"] as const;
    setBusy("all");
    let checked = 0, added = 0, episodes = 0;
    try {
      for (const selection of selections) {
        const result = await runAniListImport({ data: { selection } });
        checked += result.processed;
        added += result.seriesAdded;
        episodes += result.episodesAdded;
      }
      toast.success(`All categories checked: ${checked} results, ${added} new anime, ${episodes} episodes added`);
      qc.invalidateQueries({ queryKey: ["series"] });
    } catch (e) {
      toast.error(e instanceof Error ? `Import all stopped: ${e.message}` : "Import all stopped because an import failed");
    } finally {
      setBusy(null);
      void refetch();
    }
  };
  const toggle = async () => {
    const { error } = await supabase.from("import_settings").update({ enabled: !s?.settings?.enabled }).eq("id", true);
    if (error) toast.error(error.message); else { toast.success(s?.settings?.enabled ? "Automatic updates off" : "Automatic updates on"); void refetch(); }
  };

  const stats = s ? [["Imported anime", s.imported], ["Listed episodes", s.catalog], ["Released episodes", s.released], ["Playable (uploaded)", s.playable], ["Missing videos", Math.max(0, s.released - s.playable)], ["Currently airing", s.airing]] : [];
  return (
    <section className="space-y-4 border-y border-border py-7">
      <h2 className="text-xl font-extrabold">Automatic anime import</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(([l, v]) => <div key={l} className="rounded-md border border-border bg-card/40 p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-extrabold">{v}</p></div>)}
      </div>
      <p className="text-sm text-muted-foreground">Last successful sync: {s?.settings?.last_success_at ? new Date(s.settings.last_success_at).toLocaleString() : "never"}</p>
      <p className="text-sm text-muted-foreground">Import all categories checks trending, popular, upcoming, and currently airing lists. AniList returns up to 50 titles per list, and some titles may appear in more than one list, so this is a broad import rather than every title in the full AniList catalogue.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!!busy} onClick={runAll}>{busy === "all" && <LoaderCircle className="animate-spin" />}Import all categories</Button>
        <Button disabled={!!busy} onClick={() => run("trending")}>{busy === "trending" && <LoaderCircle className="animate-spin" />}Import trending</Button>
        <Button disabled={!!busy} variant="outline" onClick={() => run("popular")}>{busy === "popular" && <LoaderCircle className="animate-spin" />}Import popular</Button>
        <Button disabled={!!busy} variant="outline" onClick={() => run("upcoming")}>{busy === "upcoming" && <LoaderCircle className="animate-spin" />}Import upcoming now</Button>
        <Button disabled={!!busy} variant="outline" onClick={() => run("airing")}>{busy === "airing" && <LoaderCircle className="animate-spin" />}Import currently airing now</Button>
        <Button variant="outline" onClick={toggle}>Automatic updates: {s?.settings?.enabled ? "On" : "Off"}</Button>
        <Button variant="ghost" onClick={() => setHistory(!history)}>{history ? "Hide" : "View"} import history</Button>
      </div>
      {history && <ul className="divide-y divide-border text-sm">
        {s?.runs.map((r) => <li key={r.id} className="py-2"><span className={r.status === "failed" ? "text-destructive" : "text-primary"}>{r.status}</span> · {r.selection} · {new Date(r.started_at).toLocaleString()} · {r.series_added} anime, {r.episodes_added} episodes{r.error && <span className="block text-destructive">{r.error}</span>}</li>)}
        {!s?.runs.length && <li className="py-2 text-muted-foreground">No imports yet.</li>}
      </ul>}
    </section>
  );
}
