import { Link } from "@tanstack/react-router";
import { Star, Film } from "lucide-react";
import { useSignedUrl } from "@/lib/media";

export type SeriesLite = {
  id: string;
  title: string;
  cover_url: string | null;
  score: number | null;
  type: string | null;
  episodes?: { count: number }[];
};

export function SeriesCard({ s }: { s: SeriesLite }) {
  const cover = useSignedUrl(s.cover_url);
  const count = s.episodes?.[0]?.count ?? 0;
  return (
    <Link to="/series/$id" params={{ id: s.id }} className="group block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-background">
        {cover ? (
          <img src={cover} alt={s.title} loading="lazy" className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><Film className="h-10 w-10" /></div>
        )}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-overlay/80 px-1.5 py-0.5 text-xs font-bold">
          <Star className="h-3 w-3 fill-star text-star" /> {s.score ?? "N/A"}
        </span>
        <span className="absolute bottom-2 left-2 rounded bg-overlay/80 px-1.5 py-0.5 text-xs font-bold">EP {count}</span>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-sm font-semibold leading-relaxed">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        <span className="min-w-0 break-words">{s.title}</span>
      </p>
      <p className="mt-1 pl-3 text-xs text-muted-foreground">{s.type ?? "TV"}</p>
    </Link>
  );
}
