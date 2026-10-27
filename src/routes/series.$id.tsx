import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, Star, ChevronDown, Layers } from "lucide-react";
import { seriesListQuery, seriesQuery } from "@/lib/queries";
import { useSignedUrl } from "@/lib/media";

export const Route = createFileRoute("/series/$id")({
  head: () => ({
    meta: [
      { title: "Series details — Streamly" },
      { name: "description", content: "Series info, episodes and details on Streamly." },
      { property: "og:title", content: "Series details — Streamly" },
      { property: "og:description", content: "Series info, episodes and details on Streamly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeriesPage,
});

function Row({ k, v }: { k: string; v?: string | null | undefined }) {
  if (!v) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-bold text-foreground">{k}:</span>
      <span className="text-muted-foreground">{v}</span>
    </div>
  );
}

function SeriesPage() {
  const { id } = Route.useParams();
  const [audioFilter, setAudioFilter] = useState<"all" | "sub" | "dub">("all");
  const { data: s, isLoading } = useQuery(seriesQuery(id));
  const { data: catalogue = [] } = useQuery(seriesListQuery());
  const { data: franchiseRelations = [] } = useQuery({
    queryKey: ["anilist-relations", s?.anilist_id],
    enabled: !!s?.anilist_id,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          query: `query ($id: Int) { Media(id: $id, type: ANIME) { relations { edges { relationType node { id type format title { english romaji } startDate { year } } } } } }`,
          variables: { id: s!.anilist_id },
        }),
      });
      if (!response.ok) throw new Error("Could not load related seasons");
      const json = await response.json();
      return (json.data?.Media?.relations?.edges ?? [])
        .filter((edge: { relationType: string; node: { type: string; id: number } }) => edge.node.type === "ANIME" && ["SEQUEL", "PREQUEL"].includes(edge.relationType))
        .map((edge: { relationType: string; node: { id: number; title: { english: string | null; romaji: string | null }; startDate: { year: number | null }; format: string | null } }) => ({
          relationType: edge.relationType,
          anilistId: edge.node.id,
          title: edge.node.title.english || edge.node.title.romaji || "Related anime",
          year: edge.node.startDate.year,
          format: edge.node.format,
        }));
    },
  });
  const relatedSeasons = [
    ...(s?.anilist_id ? [{ id: s.id, anilistId: s.anilist_id, title: s.title, year: s.start_date ? Number(s.start_date.slice(0, 4)) : null, current: true }] : []),
    ...franchiseRelations.flatMap((relation) => {
      const local = catalogue.find((item) => Number(item.anilist_id) === relation.anilistId);
      return local ? [{ id: local.id, anilistId: relation.anilistId, title: local.title, year: relation.year, current: false }] : [];
    }),
  ].filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
   .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  const cover = useSignedUrl(s?.cover_url);
  const banner = useSignedUrl(s?.banner_url || s?.cover_url);
  if (isLoading) return <main className="pt-32 text-center text-muted-foreground">Loading...</main>;
  if (!s) return <main className="pt-32 text-center">Series not found.</main>;
  const first = s.episodes[0];

  return (
    <main>
      <section className="relative overflow-hidden pt-40 md:pt-28">
        {banner && <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 blur-sm" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-background/30" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 pb-12 md:flex-row">
          <div className="relative aspect-[3/4] w-48 shrink-0 overflow-hidden rounded-md bg-background md:w-60">
            {cover && <img src={cover} alt={s.title} className="absolute inset-0 h-full w-full object-contain" />}
          </div>
          <div className="flex-1">
            <h1 className="text-4xl font-black md:text-5xl">{s.title}</h1>
            {!!s.anilist_id && relatedSeasons.length > 1 && (
              <div className="mt-4 max-w-md">
                <label htmlFor="anime-season" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Layers className="h-4 w-4 text-primary" />Choose season or related series</label>
                <div className="relative">
                  <select id="anime-season" value={s.id} onChange={(event) => { const target = relatedSeasons.find((item) => item.id === event.target.value); if (target) window.location.href = `/series/${target.id}`; }} className="w-full appearance-none rounded-md border border-border bg-card px-3 py-3 pr-10 text-sm font-semibold text-foreground outline-none focus:border-primary">
                    {relatedSeasons.map((item, index) => <option key={item.id} value={item.id}>{item.title}{item.year ? ` (${item.year})` : ""}{item.current ? " — Current page" : ""}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Choose an imported sequel or prequel.</p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-primary-foreground"><Star className="h-3 w-3 fill-current" />{s.score ?? "N/A"}</span>
              <span className="rounded bg-secondary px-2 py-1">{s.type}</span>
              <span className="rounded bg-secondary px-2 py-1">{Math.max(s.episodes.length, s.total_episodes ?? 0, s.episode_catalog.length)} episodes</span>
              {s.episodes.length === 0 && s.episode_catalog.length > 0 && <span className="rounded bg-muted px-2 py-1 text-muted-foreground">No videos yet</span>}
            </div>
            <p className="mt-4 max-w-2xl text-foreground/85">{s.description}</p>
            {first && (
              <Link to="/watch/$episodeId" params={{ episodeId: first.id }} className="clip-slant mt-6 inline-flex items-center gap-2 bg-primary px-8 py-3 text-sm font-extrabold uppercase tracking-[0.2em] text-primary-foreground">
                <Play className="h-4 w-4 fill-current" /> Watch EP {first.number}
              </Link>
            )}
          </div>
          <div className="h-fit w-full space-y-2 rounded-lg border border-border bg-card/80 p-5 md:w-72">
            <Row k="Country" v={s.country} />
            <Row k="Start date" v={s.start_date ? new Date(s.start_date).toLocaleDateString() : null} />
            <Row k="Premiered" v={s.premiered} />
            <Row k="Status" v={s.status} />
            <Row k="Score" v={s.score?.toString()} />
            <Row k="Studios" v={s.studios.join(", ")} />
            {s.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {s.genres.map((g) => <span key={g} className="rounded-full border border-border px-2.5 py-0.5 text-xs">{g}</span>)}
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-4 border-l-4 border-primary pl-3 text-2xl font-extrabold">Episodes</h2>
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter episode audio">
          {(["all", "sub", "dub"] as const).map((option) => (
            <button type="button" key={option} aria-pressed={audioFilter === option} onClick={() => setAudioFilter(option)} className={`rounded-full border px-4 py-2 text-xs font-bold uppercase ${audioFilter === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}>
              {option === "all" ? "All episodes" : option === "sub" ? "Subtitled" : "Dubbed"}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {s.episodes.filter((e) => audioFilter !== "dub" || !!e.dub_video_path).map((e) => (
            <Link key={e.id} to="/watch/$episodeId" params={{ episodeId: e.id }} className="flex items-center gap-3 rounded-md border border-border bg-card p-3 hover:border-primary">
              <span className="rounded bg-primary/15 px-2 py-1 text-xs font-black text-primary">EP {e.number}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.title || `Episode ${e.number}`}</span><span className="shrink-0 text-[10px] font-bold text-primary">SUB{e.dub_video_path ? " · DUB" : ""}</span>
            </Link>
          ))}
          {s.episode_catalog.filter((c) => !s.episodes.some((e) => e.number === c.number)).map((c) => (
            <div key={c.id} aria-disabled="true" className="flex items-center gap-3 rounded-md border border-dashed border-border bg-card/40 p-3 opacity-70">
              <span className="rounded bg-muted px-2 py-1 text-xs font-black text-muted-foreground">EP {c.number}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-muted-foreground">{c.title || `Episode ${c.number}`}</span>
              <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">{c.released ? "Video not available yet" : "Not aired yet"}</span>
            </div>
          ))}
          {!s.episodes.length && !s.episode_catalog.length && <p className="text-muted-foreground">No episodes uploaded yet.</p>}
        </div>
      </section>
    </main>
  );
}
