import { Link } from "@tanstack/react-router";
import { Film, Star } from "lucide-react";
import { useSignedUrl } from "@/lib/media";
import type { SeriesRow } from "@/lib/queries";

export function WatchSeriesInfo({ series, count }: { series: Omit<SeriesRow, "episodes">; count: number }) {
  const cover = useSignedUrl(series.cover_url);
  return <aside className="min-w-0 self-start overflow-hidden rounded-md border border-border bg-card/40 p-3">
    <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-sm bg-muted">{cover ? <img src={cover} alt={series.title} className="h-full w-full object-cover" /> : <Film className="h-12 w-12 text-muted-foreground" />}</div>
    <Link to="/series/$id" params={{ id: series.id }} className="mt-3 block text-lg font-extrabold leading-tight hover:text-primary">{series.title}</Link>
    <div className="my-3 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase text-primary"><span className="bg-background px-2 py-1">{series.type}</span><span className="bg-background px-2 py-1">{count} episodes</span><span className="bg-background px-2 py-1">{series.status}</span></div>
    {series.description && <p className="border-y border-border py-3 text-xs leading-relaxed text-muted-foreground">{series.description}</p>}
    <dl className="space-y-2 py-3 text-xs">{[["Start date", series.start_date], ["Country", series.country], ["Genres", series.genres.join(", ")], ["Premiered", series.premiered], ["Studios", series.studios.join(", ")]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex flex-wrap gap-2"><dt className="text-muted-foreground">{label}:</dt><dd>{value}</dd></div>)}</dl>
    <div className="panel-pattern flex flex-col items-center gap-2 rounded-sm border border-border py-4"><span className="text-[10px] font-bold uppercase text-primary">Series rating</span><div className="flex gap-1">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-5 w-5 ${series.score != null && i < Math.round(series.score / 2) ? "fill-star text-star" : "text-muted-foreground"}`} />)}</div><span className="text-xs font-bold text-star">{series.score ?? "Not rated"}{series.score != null ? " / 10" : ""}</span></div>
  </aside>;
}

export function WatchRecommendation({ series }: { series: SeriesRow }) {
  const cover = useSignedUrl(series.cover_url);
  return <Link to="/series/$id" params={{ id: series.id }} className="flex min-w-0 gap-3 rounded-sm p-2 hover:bg-muted"><div className="flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <Film className="text-muted-foreground" />}</div><div className="min-w-0 self-center"><p className="line-clamp-2 text-xs font-bold">{series.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{series.type} · <span className="text-star">★ {series.score ?? "N/A"}</span></p></div></Link>;
}