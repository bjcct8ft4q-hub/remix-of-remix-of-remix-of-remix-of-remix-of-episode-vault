import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Play, Info, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { seriesListQuery, type SeriesRow } from "@/lib/queries";
import { useSignedUrl } from "@/lib/media";
import { SeriesCard } from "@/components/SeriesCard";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Streamly — Watch the latest series episodes" },
      { name: "description", content: "Watch the newest episodes, trending series and fresh uploads on Streamly." },
      { property: "og:title", content: "Streamly — Watch the latest series episodes" },
      { property: "og:description", content: "Watch the newest episodes, trending series and fresh uploads on Streamly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type S = SeriesRow;

// Keep the homepage focused on currently popular anime. Entries appear when they
// exist in the catalogue; the admin can add further titles as they become available.
const currentPopularAnime = [
  "cyberpunk: edgerunners 2",
  "cyberpunk edgerunners 2",
  "black clover 2nd season",
  "black clover season 2",
  "black clover",
  "chainsaw man",
  "my hero academia",
  "attack on titan",
  "jujutsu kaisen",
  "demon slayer",
  "solo leveling",
  "one piece",
  "the promised neverland",
  "your name",
];

function isCurrentPopularAnime(series: S) {
  const title = series.title.toLocaleLowerCase();
  return currentPopularAnime.some((name) => title.includes(name));
}

function Hero({ s }: { s: S }) {
  const img = useSignedUrl(s.banner_url || s.cover_url);
  return (
    <div className="absolute inset-0">
      {img && <img src={img} alt="" className="h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/25 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,var(--background)_0_1px,transparent_1px_4px)] opacity-30" />
      <div className="absolute bottom-16 left-5 right-5 max-w-[460px] sm:left-8 md:left-12 md:right-auto">
        <div className="flex gap-2 text-xs font-bold text-primary">
          <span className="flex items-center gap-1 rounded-sm bg-overlay/80 px-2 py-1"><Star className="h-3 w-3 fill-primary" />{s.score ?? "N/A"}</span>
          <span className="rounded-sm bg-overlay/80 px-2 py-1">{s.type}</span>
          {s.start_date && <span className="rounded-sm bg-overlay/80 px-2 py-1">{new Date(s.start_date).getFullYear()}</span>}
        </div>
        <h1 className="mt-4 break-words text-3xl font-black leading-tight md:text-4xl">{s.title}</h1>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/85">{s.description}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild className="clip-slant h-11 rounded-none px-7 text-xs font-extrabold uppercase"><Link to="/series/$id" params={{ id: s.id }}>
            <Play className="h-4 w-4 fill-current" /> Watch now
          </Link></Button>
          <Button asChild variant="outline" className="clip-slant h-11 rounded-none bg-overlay/50 px-7 text-xs font-extrabold uppercase"><Link to="/series/$id" params={{ id: s.id }}>
            <Info className="h-4 w-4" /> Details
          </Link></Button>
        </div>
      </div>
    </div>
  );
}

function Grid({ title, items, loading, filters }: { title: string; items: S[]; loading?: boolean; filters?: boolean }) {
  const [f, setF] = useState<"all" | "series" | "movies">("all");
  const shown = items.filter((s) => f === "all" || (f === "movies" ? s.type === "Movie" : s.type !== "Movie"));
  return (
    <section>
      <SectionTitle title={title}>
        {filters && (
          <div className="flex gap-4 text-sm font-semibold">
            {(["all", "series", "movies"] as const).map((k) => (
              <button key={k} onClick={() => setF(k)} className={`capitalize ${f === k ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{k}</button>
            ))}
          </div>
        )}
      </SectionTitle>
      {loading ? null : shown.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {shown.map((s) => <SeriesCard key={s.id} s={s} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No series or movies uploaded yet.</p>
      )}
    </section>
  );
}

function Schedule() {
  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() + k); return d; });
  const [sel, setSel] = useState(0);
  return (
    <aside className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-4 text-xl font-extrabold">Schedule</h2>
      <div className="grid grid-cols-7 gap-1.5 border-b border-border pb-4">
        {days.map((d, k) => (
          <button key={k} onClick={() => setSel(k)} className="flex flex-col items-center gap-1">
            <span className={`text-[10px] font-bold uppercase ${sel === k ? "text-primary" : "text-muted-foreground"}`}>{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
            <span className={`grid h-9 w-full place-items-center rounded text-sm font-extrabold ${sel === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{d.getDate()}</span>
          </button>
        ))}
      </div>
      <p className="pt-4 text-sm text-muted-foreground">No episodes scheduled for this day.</p>
    </aside>
  );
}

function SectionTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="border-l-[3px] border-primary pl-3 text-xl font-extrabold md:text-2xl">{title}</h2>
      {children}
    </div>
  );
}

function Row({ title, items }: { title: string; items: S[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section>
      <SectionTitle title={title}>
        <div className="flex items-center gap-2">
          <Link to="/browse" className="mr-2 text-xs font-semibold text-muted-foreground hover:text-primary">View all</Link>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" aria-label={`Scroll ${title} left`} onClick={() => scroll(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" aria-label={`Scroll ${title} right`} onClick={() => scroll(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </SectionTitle>
      <div ref={ref} className="flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
        {items.map((s) => (
          <div key={s.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-[23%] xl:w-[15.5%]"><SeriesCard s={s} /></div>
        ))}
      </div>
    </section>
  );
}

function Index() {
  const { data = [], isLoading } = useQuery(seriesListQuery());
  const { isAdmin, user } = useAuth();
  const [i, setI] = useState(0);
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const popularAnime = data.filter(isCurrentPopularAnime).slice(0, 12);
  const featured = popularAnime.slice(0, 8);
  const activeIndex = featured.length ? i % featured.length : 0;
  const current = featured[activeIndex];

  useEffect(() => {
    if (featured.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % featured.length), 7000);
    return () => clearInterval(t);
  }, [featured.length]);

  return (
    <main>
      <section className="relative h-[64svh] min-h-[480px] max-h-[680px] overflow-hidden max-sm:min-h-[550px]">
        {current ? (
          <>
            <Hero key={current.id} s={current} />
            <div className="absolute right-5 top-36 flex gap-2 md:top-20">
              {[ChevronLeft, ChevronRight].map((Ic, k) => (
                <Button variant="outline" size="icon" key={k} aria-label={k ? "Next" : "Previous"} onClick={() => setI((x) => (x + (k ? 1 : -1) + featured.length) % featured.length)} className="bg-overlay/60">
                  <Ic className="h-4 w-4" />
                </Button>
              ))}
            </div>
            <div className="absolute bottom-8 right-6 flex items-center gap-1">
              {featured.map((f, k) => (
                <Button variant="ghost" key={f.id} aria-label={`Slide ${k + 1}`} aria-pressed={k === activeIndex} onClick={() => setI(k)} className="h-6 w-7 rounded-none p-0"><span className={`h-1 rounded-full ${k === activeIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/50"}`} /></Button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col justify-end gap-4 px-5 pb-20 sm:px-8 md:px-12">
            <p className="text-sm font-bold uppercase text-primary">Streamly</p>
            <h1 className="max-w-lg text-4xl font-black">{isLoading ? "Loading..." : "Nothing streaming yet"}</h1>
            {!isLoading && (
              <p className="text-muted-foreground">
                {isAdmin ? <Link to="/admin" className="font-semibold text-primary">Add your first series →</Link> : user ? "An admin hasn't added any series yet." : "Sign in as an admin to add series."}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="mx-auto grid max-w-[1900px] items-start gap-6 px-4 pb-20 pt-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-12">
          <Grid title="Latest Episodes" items={data} loading={isLoading} filters />
          {data.length > 0 && <Row title="Popular Now" items={[...data].sort((a, b) => (b.episodes?.[0]?.count ?? 0) - (a.episodes?.[0]?.count ?? 0))} />}
          {data.length > 0 && <Grid title="Recently Added" items={[...data].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 12)} />}
          <Grid title="Popular Anime" items={popularAnime} loading={isLoading} filters />
        </div>
        <div className="space-y-6">
          <aside className="relative overflow-hidden rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-xl font-extrabold">Top Rated</h2>
              <div className="flex gap-4 text-[11px] font-bold uppercase tracking-wider">
                {(["day", "week", "month"] as const).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} className={period === p ? "border-b-2 border-primary pb-1 text-primary" : "pb-1 text-muted-foreground hover:text-foreground"}>{p}</button>
                ))}
              </div>
            </div>
            <div className="mb-5 h-0.5 w-10 bg-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">No top rated series or movies available yet.</p>
          </aside>
          <Schedule />
        </div>
      </div>
    </main>
  );
}
