import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type TmdbSearchResult = {
  id: number;
  name: string;
  original_name: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  number_of_seasons?: number;
  genre_ids?: number[];
};

async function tmdb<T>(path: string): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB is not configured on the server. Add TMDB_READ_ACCESS_TOKEN to the server secrets/environment and redeploy.");
  const response = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 429) throw new Error("TMDB rate limit reached. Wait a moment and try again.");
  if (!response.ok) throw new Error(`TMDB returned HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}

export const searchTmdbSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ query: z.string().trim().min(1).max(160), year: z.number().int().min(1900).max(2100).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const params = new URLSearchParams({ query: data.query, include_adult: "false" });
    if (data.year) params.set("first_air_date_year", String(data.year));
    const result = await tmdb<{ results: TmdbSearchResult[] }>(`/search/tv?${params.toString()}`);
    return (result.results ?? []).slice(0, 8).map((item) => ({
      id: item.id, title: item.name || item.original_name,
      year: item.first_air_date?.slice(0, 4) ?? null,
      overview: item.overview ?? "", poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
      seasons: item.number_of_seasons ?? 0,
    }));
  });

export const importTmdbSeasons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ seriesId: z.string().uuid(), tmdbId: z.number().int().positive() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");

    const db = context.supabase;
    const { data: series, error: seriesError } = await db.from("series").select("id,title,description,start_date,cover_url,import_locked,tmdb_id").eq("id", data.seriesId).single();
    if (seriesError || !series) throw new Error("The selected series could not be found.");
    const details = await tmdb<{ id: number; name: string; overview?: string; poster_path?: string | null; seasons?: { id: number; season_number: number; name: string; episode_count: number; air_date?: string | null }[] }>(`/tv/${data.tmdbId}`);
    const dbAny = db as any;
    const currentSeries = series as typeof series & { tmdb_id?: number | null };
    if (currentSeries.tmdb_id && currentSeries.tmdb_id !== data.tmdbId) {
      throw new Error("This series is already linked to a different TMDB title. Resolve the match before changing it.");
    }
    const { error: linkError } = await dbAny.from("series").update({ tmdb_id: data.tmdbId }).eq("id", series.id);
    if (linkError) throw new Error(`Could not save the TMDB match: ${linkError.message}`);

    let added = 0, updated = 0, checked = 0;
    const seasons = (details.seasons ?? []).filter((s) => s.season_number >= 0);
    for (const season of seasons) {
      const seasonData = await tmdb<{ episodes?: { id: number; episode_number: number; name?: string; overview?: string; air_date?: string | null; still_path?: string | null }[] }>(`/tv/${data.tmdbId}/season/${season.season_number}`);
      for (const ep of seasonData.episodes ?? []) {
        if (!Number.isInteger(ep.episode_number) || ep.episode_number < 1) continue;
        checked++;
        const existingResult = await dbAny.from("episode_catalog")
          .select("id,number,title,air_date,thumbnail_path,import_locked,season_number,season_episode_number,description,tmdb_episode_id")
          .eq("series_id", series.id)
          .eq("season_number", season.season_number)
          .eq("season_episode_number", ep.episode_number)
          .maybeSingle();
        if (existingResult.error) throw new Error(`Could not read the episode catalogue: ${existingResult.error.message}. Ensure the TMDB migration has been applied.`);
        const row = {
          series_id: series.id,
          number: ep.episode_number,
          season_number: season.season_number,
          season_episode_number: ep.episode_number,
          tmdb_episode_id: ep.id,
          title: ep.name || null,
          description: ep.overview || null,
          air_date: ep.air_date || null,
          thumbnail_path: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
          released: !!ep.air_date && ep.air_date <= new Date().toISOString().slice(0, 10),
        };
        const existing = existingResult.data;
        if (!existing) {
          const { error } = await dbAny.from("episode_catalog").insert(row);
          if (error) {
            if (/duplicate|unique/i.test(error.message)) continue;
            throw new Error(`Could not add S${season.season_number} E${ep.episode_number}: ${error.message}`);
          }
          added++;
        } else if (!existing.import_locked) {
          const patch: Record<string, unknown> = {};
          if (!existing.title) patch.title = row.title;
          if (!existing.air_date) patch.air_date = row.air_date;
          if (!existing.thumbnail_path) patch.thumbnail_path = row.thumbnail_path;
          if (!existing.description) patch.description = row.description;
          patch.tmdb_episode_id = ep.id;
          patch.season_number = season.season_number;
          patch.season_episode_number = ep.episode_number;
          if (Object.keys(patch).length) {
            const { error } = await dbAny.from("episode_catalog").update(patch).eq("id", existing.id);
            if (error) throw new Error(`Could not update S${season.season_number} E${ep.episode_number}: ${error.message}`);
            updated++;
          }
        }
      }
    }
    return { seriesTitle: details.name || series.title, seasons: seasons.length, checked, added, updated };
  });
