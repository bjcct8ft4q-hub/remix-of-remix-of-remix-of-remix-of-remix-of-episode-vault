import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronRight, Film, Maximize, Minimize, Search, Subtitles, Mic, Trash2, UserRound, ArrowLeft, ArrowRight, Flag, Keyboard, Play, SkipForward, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { commentsQuery, seriesQuery, seriesListQuery } from "@/lib/queries";
import { useSignedUrl } from "@/lib/media";
import { episodeVideoPath } from "@/lib/episode-video";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { WatchSeriesInfo, WatchRecommendation } from "@/components/WatchSeriesInfo";
import { VideoPlayer } from "@/components/VideoPlayer";
import type { Database } from "@/integrations/supabase/types";

type Ep = Database["public"]["Tables"]["episodes"]["Row"];
function EpisodeCard({ episode, active, version, fallback }: { episode: Ep; active: boolean; version: "sub" | "dub"; fallback: string | null }) {
  const img = useSignedUrl(episode.thumbnail_path) ?? fallback;
  return <Link to="/watch/$episodeId" params={{ episodeId: episode.id }} search={{ lang: version }} aria-current={active ? "page" : undefined} className={`panel-pattern flex min-h-20 gap-3 overflow-hidden rounded-md border p-2 ${active ? "border-primary border-l-4 bg-primary/10" : "border-border bg-card/30 hover:border-primary/50"}`}>
    <div className="relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted">{img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Film className="text-muted-foreground" />}{active && <span className="absolute flex h-6 w-6 items-center justify-center rounded-sm bg-overlay/70 text-primary"><Play className="h-3 w-3 fill-current" /></span>}</div>
    <div className="flex min-w-0 flex-1 flex-col">
      <p className={`text-[9px] font-bold uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}>EP {String(episode.number).padStart(2, "0")}</p>
      <p className={`line-clamp-2 text-xs font-bold ${active ? "text-primary" : ""}`}>{episode.title || `Episode ${episode.number}`}</p>
      <div className="mt-auto flex items-end justify-between gap-1 pt-1 text-[8px] font-bold"><div className="flex gap-1"><span className="rounded-sm bg-muted px-1.5 py-0.5 text-muted-foreground">SUB</span>{episode.dub_video_path && <span className="rounded-sm bg-primary px-1.5 py-0.5 text-primary-foreground">DUB</span>}</div>{episode.air_date && <span className="uppercase tracking-wider text-muted-foreground">{new Date(episode.air_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}</div>
    </div>
  </Link>;
}

export const Route = createFileRoute("/watch/$episodeId")({
  validateSearch: z.object({ lang: z.enum(["sub", "dub"]).optional() }),
  head: () => ({ meta: [
    { title: "Watch episode — Streamly" },
    { name: "description", content: "Watch subtitled and dubbed episodes, browse the episode list and join the discussion on Streamly." },
    { property: "og:title", content: "Watch episode — Streamly" },
    { property: "og:description", content: "Watch subtitled and dubbed episodes, browse the episode list and join the discussion on Streamly." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Watch,
});

function Watch() {
  const { episodeId } = Route.useParams();
  const { lang = "sub" } = Route.useSearch();
  const { user, isAdmin, openAuth } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: ep, isPending, isError } = useQuery({ queryKey: ["episode", episodeId], queryFn: async () => {
    const { data, error } = await supabase.from("episodes").select("*").eq("id", episodeId).maybeSingle();
    if (error) throw error;
    return data;
  } });
  const { data: series } = useQuery({ ...seriesQuery(ep?.series_id ?? ""), enabled: !!ep });
  const { data: catalog = [] } = useQuery(seriesListQuery());
  const { data: comments = [] } = useQuery(commentsQuery(episodeId));
  const version = lang === "dub" && ep?.dub_video_path ? "dub" : "sub";
  const video = useSignedUrl(ep ? episodeVideoPath(ep, version) : null);
  const poster = useSignedUrl(series?.banner_url || series?.cover_url);
  const [body, setBody] = useState("");
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "sub" | "dub">("all");
  const [theater, setTheater] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [autonext, setAutonext] = useState(false);
  const [autoskip, setAutoskip] = useState(false);
  const thumb = useSignedUrl(ep?.thumbnail_path);
  const [oldest, setOldest] = useState(false);
  const [posting, setPosting] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resumeTime = useRef(0);
  const episodes = series?.episodes ?? [];
  const index = episodes.findIndex((episode) => episode.id === episodeId);
  const previous = episodes[index - 1];
  const next = episodes[index + 1];
  const shown = episodes.filter((episode) => (filter !== "dub" || !!episode.dub_video_path) && `${episode.number} ${episode.title ?? ""}`.toLowerCase().includes(episodeSearch.toLowerCase()));
  const recommendations = catalog.filter((item) => item.id !== series?.id).sort((a, b) => Number(b.genres.some((genre) => series?.genres.includes(genre))) - Number(a.genres.some((genre) => series?.genres.includes(genre)))).slice(0, 6);

  const post = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return void openAuth("signin");
    const text = body.trim();
    if (!text || text.length > 1000) return void toast.error("Comment must be 1–1000 characters");
    setPosting(true);
    try {
      const { error } = await supabase.from("comments").insert({ episode_id: episodeId, user_id: user.id, body: text });
      if (error) throw error;
      setBody("");
      await qc.invalidateQueries({ queryKey: ["comments", episodeId] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Comment could not be posted."); }
    finally { setPosting(false); }
  };
  const del = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["comments", episodeId] });
  };
  if (isPending) return <main className="pt-40 text-center text-muted-foreground">Loading episode…</main>;
  if (isError || !ep) return <main className="px-6 pt-40 text-center"><h1 className="text-xl font-bold">{isError ? "Episode couldn’t be loaded." : "Episode not found."}</h1><Button asChild variant="outline" className="mt-4"><Link to="/browse">Browse series</Link></Button></main>;

  return <main className="mx-auto max-w-[1800px] px-4 pb-16 pt-36 sm:px-6 md:pt-24">
    <div className={`grid items-start gap-4 ${theater ? "lg:grid-cols-[minmax(0,1fr)_290px]" : "lg:grid-cols-[190px_minmax(0,1fr)_290px] xl:grid-cols-[220px_minmax(0,1fr)_300px]"}`}>
      {!theater && series && <div className="hidden lg:block"><WatchSeriesInfo series={series} count={episodes.length} /></div>}
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="mb-2 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground"><Link to="/">Home</Link><ChevronRight className="h-3 w-3 shrink-0" />{series && <><Link to="/series/$id" params={{ id: series.id }} className="truncate text-foreground">{series.title}</Link><ChevronRight className="h-3 w-3 shrink-0" /></>}<span className="shrink-0 text-primary">Episode {ep.number}</span></nav>
        <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-overlay">
          {video ? <VideoPlayer ref={videoRef} key={`${episodeId}-${version}-${video}`} src={video} poster={thumb ?? poster ?? undefined} autoPlay={autoplay} autoSkip={autoskip} fileName={`${series?.title ?? "episode"}-EP${ep.number}-${version}`.replace(/[^\w-]+/g, "_")} onLoaded={(el) => { if (resumeTime.current) el.currentTime = resumeTime.current; resumeTime.current = 0; setVideoError(false); }} onError={() => setVideoError(true)} onEnded={() => { if (autonext && next) navigate({ to: "/watch/$episodeId", params: { episodeId: next.id }, search: { lang: version } }); }} /> : <div role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading video…</div>}
          {videoError && <div role="alert" className="absolute inset-x-0 top-0 bg-background/90 p-3 text-sm text-destructive">This video could not be played. Try the other version or reload the page.</div>}
        </div>
        <p className="mt-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/15 px-3 py-2 text-xs"><Flag className="h-3.5 w-3.5 shrink-0" />If episode is not working, please report it, and we will fix it as soon as possible.</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border py-2 text-[11px] font-extrabold uppercase">
          <button type="button" onClick={() => setTheater(!theater)} className="flex items-center gap-1.5 hover:text-primary">{theater ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}Theater</button>
          <span title="Space: play/pause · ←/→: 10s · F: fullscreen · M: mute" className="flex cursor-help items-center gap-1.5"><Keyboard className="h-3.5 w-3.5" />Keys</span>
          {([["Auto play", autoplay, setAutoplay, Play], ["Auto next", autonext, setAutonext, SkipForward], ["Auto skip", autoskip, setAutoskip, Scissors]] as const).map(([label, on, set, Icon]) => <button key={label} type="button" aria-pressed={on} onClick={() => set(!on)} className={`flex items-center gap-1.5 ${on ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
          <div className="flex gap-1">{previous && <Button asChild variant="ghost" size="icon" aria-label="Previous episode"><Link to="/watch/$episodeId" params={{ episodeId: previous.id }} search={{ lang: version }}><ArrowLeft /></Link></Button>}{next && <Button asChild variant="ghost" size="icon" aria-label="Next episode"><Link to="/watch/$episodeId" params={{ episodeId: next.id }} search={{ lang: version }}><ArrowRight /></Link></Button>}</div>
        </div>
        <div className="grid gap-4 border-b border-border py-5 sm:grid-cols-2">
          <div className="text-center"><p className="text-sm text-muted-foreground">You are Watching</p><h1 className="mt-1 text-sm font-extrabold">Episode {ep.number}{ep.title ? ` — ${ep.title}` : ""}</h1><p className="mt-1 text-xs text-muted-foreground">If the current version doesn't work, please try the other one beside.</p></div>
          <div className="flex flex-col justify-center gap-2">{(["sub", "dub"] as const).filter((audio) => audio === "sub" || ep.dub_video_path).map((audio) => <div key={audio} className="flex items-center gap-3"><span className="flex w-14 items-center gap-1 text-[11px] font-bold uppercase text-muted-foreground">{audio === "sub" ? <Subtitles className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}{audio}:</span><Button asChild size="sm" variant={version === audio ? "default" : "secondary"}><Link to="/watch/$episodeId" params={{ episodeId }} search={{ lang: audio }} onClick={() => { resumeTime.current = videoRef.current?.currentTime ?? 0; setVideoError(false); }} aria-current={version === audio ? "true" : undefined}>{audio === "sub" ? "Subtitled" : "Dubbed"}</Link></Button></div>)}</div>
        </div>
      </div>
      <aside className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="font-extrabold">Episodes <span className="ml-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{episodes.length}</span></h2><div className="flex">{(["all", "sub", "dub"] as const).map((value) => <Button key={value} size="sm" variant={filter === value ? "secondary" : "ghost"} onClick={() => setFilter(value)} aria-pressed={filter === value} className="h-6 px-2 text-[9px] uppercase">{value}</Button>)}</div></div>
        <label className="mb-2 flex h-9 items-center gap-2 rounded-sm border border-border bg-card/40 px-2"><input aria-label="Search episodes" value={episodeSearch} onChange={(event) => setEpisodeSearch(event.target.value)} placeholder="Search episodes…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /><Search className="h-3.5 w-3.5 text-muted-foreground" /></label>
        <div className="max-h-[720px] space-y-1.5 overflow-y-auto pr-1">{shown.map((episode) => <EpisodeCard key={episode.id} episode={episode} active={episodeId === episode.id} version={version} fallback={poster} />)}{!shown.length && <p className="py-6 text-center text-xs text-muted-foreground">No episodes found.</p>}</div>
      </aside>
    </div>
    <div className="mt-6 grid gap-6 border-t border-border pt-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-sm font-extrabold uppercase">Comments <span className="ml-1 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{comments.length}</span></h2><div className="flex gap-1"><Button size="sm" variant={!oldest ? "default" : "ghost"} onClick={() => setOldest(false)} className="h-7 text-xs">Newest</Button><Button size="sm" variant={oldest ? "default" : "ghost"} onClick={() => setOldest(true)} className="h-7 text-xs">Oldest</Button></div></div>
        {user ? <form onSubmit={post} className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="h-5 w-5" /></span><div className="min-w-0 flex-1"><textarea aria-label="Write your comment" value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} rows={3} placeholder="Write your comment…" className="w-full resize-y rounded-sm border border-border bg-card/40 p-3 text-xs outline-none focus:border-primary" /><Button type="submit" size="sm" disabled={posting || !body.trim()} className="mt-2">{posting ? "Posting…" : "Post comment"}</Button></div></form> : <Button variant="outline" onClick={() => openAuth("signin")} className="w-full justify-start text-sm text-muted-foreground">Sign in to comment</Button>}
        <ul className="mt-6 divide-y divide-border/50">{(oldest ? [...comments].reverse() : comments).map((comment) => <li key={comment.id} className="flex gap-3 py-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-primary">{(comment.profiles?.username ?? "U").slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[10px]"><span className="font-bold text-primary">{comment.profiles?.username ?? "user"}</span><time className="text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</time>{(comment.user_id === user?.id || isAdmin) && <Button variant="ghost" size="icon" aria-label="Delete comment" onClick={() => del(comment.id)} className="ml-auto h-6 w-6 text-muted-foreground"><Trash2 /></Button>}</div><p className="mt-2 break-words text-sm leading-relaxed">{comment.body}</p></div></li>)}</ul>{!comments.length && <p className="py-6 text-xs text-muted-foreground">No comments yet.</p>}
      </section>
      <aside className="min-w-0"><h2 className="mb-3 border-l-3 border-primary pl-2 font-extrabold">Recommendations</h2>{recommendations.map((item) => <WatchRecommendation key={item.id} series={item} />)}{!recommendations.length && <p className="text-xs text-muted-foreground">No recommendations yet.</p>}</aside>
    </div>
  </main>;
}