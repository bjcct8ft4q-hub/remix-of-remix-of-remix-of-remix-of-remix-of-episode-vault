import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, RefreshCw, Flame, TrendingUp, CalendarClock, Radio, Layers3, History, ChevronDown, Database, Film, CircleHelp, Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { importStats, runAniListImport } from "@/lib/anilist.functions";
import { searchAnimeDoc, importAnimeDocEpisodes } from "@/lib/animedoc.functions";
import { Button } from "@/components/ui/button";

export function ImportPanel() {
  const qc = useQueryClient();
  const { data: s, refetch } = useQuery({ queryKey: ["import-stats"], queryFn: () => importStats() });
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [showIndividual, setShowIndividual] = useState(false);
  const [animeSearch, setAnimeSearch] = useState("");
  const [animeResults, setAnimeResults] = useState<{ id: number; title: string; year: number | null; cover: string | null }[]>([]);
  const [searchingAnime, setSearchingAnime] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<{ id: number; title: string; year: number | null } | null>(null);
  const [sourceResults, setSourceResults] = useState<{ subjectId: number; detailPath: string; title: string; year: number | null; cover: string | null; episodeCount: number }[]>([]);
  const [selectedSource, setSelectedSource] = useState<{ subjectId: number; detailPath: string; title: string; cover: string | null; episodeCount: number } | null>(null);

  const searchAnime = async () => {
    const term = animeSearch.trim();
    if (!term) return;
    setSearchingAnime(true);
    setSelectedAnime(null);
    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query: `query ($search: String) { Page(perPage: 8) { media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) { id title { english romaji } startDate { year } coverImage { medium } } } }`,
          variables: { search: term },
        }),
      });
      if (!response.ok) throw new Error("AniList search failed. Try again shortly.");
      const json = await response.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      const results = json.data?.Page?.media ?? [];
      setAnimeResults(results.map((item: { id: number; title: { english: string | null; romaji: string }; startDate: { year: number | null }; coverImage: { medium: string | null } }) => ({
        id: item.id, title: item.title.english || item.title.romaji, year: item.startDate.year, cover: item.coverImage.medium,
      })));
      if (!results.length) toast.info("No anime found for that search.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Anime search failed");
    } finally {
      setSearchingAnime(false);
    }
  };

  const importSpecific = async () => {
    if (!selectedSource) return;
    setBusy("specific");
    try {
      const result = await importAnimeDocEpisodes({ data: {
        subjectId: selectedSource.subjectId, detailPath: selectedSource.detailPath,
        title: selectedSource.title, cover: selectedSource.cover,
      } });
      toast.success(`${result.title}: ${result.seriesAdded ? "added to Streamly" : "updated"}; ${result.episodesAdded} episode entries added`);
      if (result.note) toast.info(result.note);
      setSourceResults([]);
      setSelectedSource(null);
      setAnimeSearch("");
      qc.invalidateQueries({ queryKey: ["series"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AnimeDoc import failed");
    } finally { setBusy(null); void refetch(); }
  };

  const searchSourceAnime = async () => {
    const term = animeSearch.trim();
    if (!term) return;
    setSearchingAnime(true);
    setSelectedSource(null);
    try {
      const results = await searchAnimeDoc({ data: { query: term } });
      setSourceResults(results);
      if (!results.length) toast.info("AnimeDoc returned no matching anime.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AnimeDoc search failed");
    } finally { setSearchingAnime(false); }
  };

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

  const stats = s ? [
    { label: "Imported anime", value: s.imported, icon: Film },
    { label: "Listed episodes", value: s.catalog, icon: Layers3 },
    { label: "Released episodes", value: s.released, icon: CalendarClock },
    { label: "Videos available", value: s.playable, icon: Database },
    { label: "Missing videos", value: Math.max(0, s.released - s.playable), icon: CircleHelp },
    { label: "Currently airing", value: s.airing, icon: Radio },
  ] : [];
  const actionButton = (selection: "trending" | "popular" | "upcoming" | "airing", label: string, Icon: typeof Flame, description: string) => (
    <button key={selection} disabled={!!busy} onClick={() => run(selection)} className="group flex w-full items-center gap-3 rounded-xl border border-border bg-background/60 p-3 text-left transition hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span>
      {busy === selection ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />}
    </button>
  );
  return (
    <section className="space-y-6 border-y border-border py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Database className="h-4 w-4" /> Catalogue tools</div>
          <h2 className="text-2xl font-extrabold tracking-tight">Anime import</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Manage your AniList catalogue, update releases, and check import activity from one place.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-border bg-card px-3 py-2 text-xs font-medium sm:self-auto">
          <span className={s?.settings?.enabled ? "h-2 w-2 rounded-full bg-emerald-500" : "h-2 w-2 rounded-full bg-muted-foreground"} />
          Automatic updates {s?.settings?.enabled ? "on" : "off"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map(({label,value,icon:Icon}) => <div key={label} className="rounded-xl border border-border bg-card/60 p-4"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{label}</span><Icon className="h-4 w-4 shrink-0 text-muted-foreground" /></div><p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p></div>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card/70 to-card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Layers3 className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold">Import all categories</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Check trending, popular, upcoming, and currently airing anime. Titles already in your catalogue are updated instead of duplicated.</p>
              <Button className="mt-4" disabled={!!busy} onClick={runAll}>{busy === "all" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} {busy === "all" ? "Importing categories…" : "Run full category import"}</Button>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card/50 p-5">
          <div><h3 className="font-bold">Sync status</h3><p className="mt-1 text-sm text-muted-foreground">Last successful sync</p><p className="mt-1 text-sm font-semibold">{s?.settings?.last_success_at ? new Date(s.settings.last_success_at).toLocaleString() : "No successful sync recorded"}</p></div>
          <Button variant="outline" className="w-full sm:w-fit" disabled={!!busy} onClick={toggle}>{s?.settings?.enabled ? "Turn automatic updates off" : "Turn automatic updates on"}</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/25 bg-card/50 p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="font-bold">Import a specific anime or season</h3>
          <p className="mt-1 text-sm text-muted-foreground">Search AnimeDoc, choose a title, then import its episode catalogue. Your API key stays on the server.</p>
        </div>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void searchSourceAnime(); }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={animeSearch} onChange={(event) => setAnimeSearch(event.target.value)} placeholder="Search e.g. Tokyo Ghoul √A" aria-label="Search AnimeDoc for an anime to import" className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <Button type="submit" variant="outline" disabled={searchingAnime || !animeSearch.trim()}>{searchingAnime ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Search AnimeDoc</Button>
        </form>
        {sourceResults.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{sourceResults.map((anime) => <button type="button" key={anime.subjectId} onClick={() => setSelectedSource({ subjectId: anime.subjectId, detailPath: anime.detailPath, title: anime.title, cover: anime.cover, episodeCount: anime.episodeCount })} className={`flex items-center gap-3 rounded-lg border p-2 text-left transition ${selectedSource?.subjectId === anime.subjectId ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>{anime.cover ? <img src={anime.cover} alt="" className="h-14 w-10 rounded object-cover" /> : <span className="h-14 w-10 rounded bg-muted" />}<span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{anime.title}</span><span className="text-xs text-muted-foreground">{anime.year ?? "Year unknown"} · {anime.episodeCount || "Episode count in details"} episodes · AnimeDoc</span></span><span className="text-xs font-semibold text-primary">{selectedSource?.subjectId === anime.subjectId ? "Selected" : "Select"}</span></button>)}</div>}
        {selectedSource && <div className="mt-3 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm">Ready to import <strong>{selectedSource.title}</strong> and create its episode entries.</p><Button disabled={!!busy} onClick={() => void importSpecific()}>{busy === "specific" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Import episodes</Button></div>}
      </div>

      <div className="rounded-2xl border border-border p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">Choose an import</h3><p className="text-sm text-muted-foreground">Run one focused category if you don't need a full refresh.</p></div><button onClick={() => setShowIndividual(!showIndividual)} className="inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">{showIndividual ? "Hide categories" : "Show categories"}<ChevronDown className={`h-4 w-4 transition-transform ${showIndividual ? "rotate-180" : ""}`} /></button></div>
        {showIndividual && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actionButton("trending","Trending",Flame,"What's gaining attention")}
          {actionButton("popular","Popular",TrendingUp,"Popular anime across AniList")}
          {actionButton("upcoming","Upcoming",CalendarClock,"Announced, not yet released")}
          {actionButton("airing","Currently airing",Radio,"Anime currently being released")}
        </div>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-bold">Import history</h3><p className="text-sm text-muted-foreground">Review previous runs and any errors.</p></div>
        <Button variant="outline" onClick={() => setHistory(!history)}><History className="mr-2 h-4 w-4" />{history ? "Hide history" : "View history"}<ChevronDown className={`ml-2 h-4 w-4 transition-transform ${history ? "rotate-180" : ""}`} /></Button>
      </div>
      {history && <ul className="divide-y divide-border rounded-xl border border-border px-4 text-sm">
        {s?.runs.map((r) => <li key={r.id} className="py-3"><div className="flex flex-wrap items-center gap-2"><span className={r.status === "failed" ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive" : "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"}>{r.status}</span><span className="font-medium">{r.selection}</span><span className="text-muted-foreground">· {new Date(r.started_at).toLocaleString()}</span></div><p className="mt-1 text-muted-foreground">{r.series_added} anime and {r.episodes_added} episodes added</p>{r.error && <p className="mt-2 break-words text-destructive">{r.error}</p>}</li>)}
        {!s?.runs.length && <li className="py-4 text-muted-foreground">No imports recorded yet.</li>}
      </ul>}
    </section>
  );
}
