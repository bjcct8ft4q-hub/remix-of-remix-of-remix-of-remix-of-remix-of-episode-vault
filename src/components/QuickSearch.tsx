import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight, Film, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { seriesListQuery } from "@/lib/queries";

export function QuickSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const { data = [], isPending, isError, refetch } = useQuery({ ...seriesListQuery(), enabled: open });
  const term = query.trim().toLowerCase();
  const matches = term
    ? data.filter((series) => series.title.toLowerCase().includes(term) || series.genres.some((genre) => genre.toLowerCase().includes(term)))
    : [...data].sort((a, b) => (b.episodes?.[0]?.count ?? 0) - (a.episodes?.[0]?.count ?? 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-overlay/85 backdrop-blur-sm" />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none">
          <div className="mb-2 flex h-8 items-center justify-between px-1">
            <DialogTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick access</DialogTitle>
            <DialogClose asChild><Button variant="ghost" size="icon" aria-label="Close search"><X /></Button></DialogClose>
          </div>
          <div className="relative overflow-hidden rounded-md border border-border border-t-primary bg-background">
            <div className="halloween-web pointer-events-none absolute right-0 top-0 h-24 w-24 rotate-90" />
            <div className="flex h-10 items-center justify-center border-b border-border text-xs font-bold uppercase text-primary"><span className="flex h-full items-center gap-2 border-b-2 border-primary px-4"><Film className="h-3.5 w-3.5" />Series</span></div>
            <form onSubmit={(event) => event.preventDefault()} className="flex h-12 items-center gap-2 px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search series..." aria-label="Quick search series" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              {query && <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => setQuery("")}><X /></Button>}
            </form>
          </div>
          <div className="relative mt-2 overflow-hidden rounded-md border border-border bg-background">
            <div className="halloween-web pointer-events-none absolute right-0 top-0 h-32 w-32 rotate-90" />
            <h2 className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{term ? "Search results" : "Trending now"}</h2>
            <div className="max-h-[min(50dvh,24rem)] overflow-y-auto p-2">
              {isPending ? <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading series…</div>
                : isError ? <div role="alert" className="py-6 text-center text-sm text-muted-foreground"><p>Series couldn’t be loaded.</p><Button variant="ghost" onClick={() => void refetch()} className="mt-2">Try again</Button></div>
                : matches.length === 0 ? <p role="status" className="px-3 py-8 text-center text-sm text-muted-foreground">{term ? "No series found." : "No series available yet."}</p>
                : matches.slice(0, term ? 10 : 5).map((series, index) => (
                  <Button asChild variant="ghost" key={series.id} className="h-auto min-h-16 w-full justify-start gap-3 whitespace-normal px-1.5 py-2">
                    <Link to="/series/$id" params={{ id: series.id }} onClick={() => onOpenChange(false)}>
                      <span className="w-4 shrink-0 text-[10px] font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
                      {series.cover_url ? <img src={series.cover_url} alt="" className="h-12 w-9 shrink-0 rounded-sm object-cover" /> : <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-sm bg-muted"><Film className="text-muted-foreground" /></span>}
                      <span className="min-w-0 flex-1"><span className="line-clamp-2 text-xs font-bold">{series.title}</span><span className="mt-1 block text-[10px] text-muted-foreground">{series.type}{series.premiered ? ` · ${series.premiered}` : ""}</span></span>
                      <ChevronRight className="shrink-0 text-muted-foreground" />
                    </Link>
                  </Button>
                ))}
            </div>
            {term && <Button asChild variant="ghost" className="h-10 w-full justify-between rounded-none border-t border-border px-3 text-xs text-primary"><Link to="/browse" search={{ q: query.trim() }} onClick={() => onOpenChange(false)}>View all results<ArrowRight /></Link></Button>}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}