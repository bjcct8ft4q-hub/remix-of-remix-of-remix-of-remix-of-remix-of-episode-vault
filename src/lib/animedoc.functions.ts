import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Anime = { mal_id: number; title?: string; title_english?: string | null; episodes?: number | null; year?: number | null; aired?: { prop?: { from?: { year?: number | null } } }; images?: { jpg?: { image_url?: string | null }; webp?: { image_url?: string | null } } };
type JikanEpisode = { episode?: string | null; title?: string | null };
async function jikan<T>(path: string): Promise<T> {
  const response = await fetch("https://api.jikan.moe/v4" + path, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (response.status === 429) throw new Error("Jikan is rate-limiting requests. Wait about a minute, then try again.");
  if (!response.ok) throw new Error("Jikan returned HTTP " + response.status + ".");
  return response.json() as Promise<T>;
}
async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Admins only");
}

// Keep the existing exported names so the current import panel remains compatible; requests now use Jikan.
export const searchAnimeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ query: z.string().trim().min(1).max(160) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const result = await jikan<{ data: Anime[] }>("/anime?q=" + encodeURIComponent(data.query) + "&limit=10&sfw=true");
    return (result.data || []).map((anime) => ({
      subjectId: String(anime.mal_id),
      detailPath: String(anime.mal_id),
      title: anime.title_english || anime.title || "Untitled anime",
      year: anime.year ?? anime.aired?.prop?.from?.year ?? null,
      cover: anime.images?.webp?.image_url || anime.images?.jpg?.image_url || null,
      episodeCount: anime.episodes ?? 0,
    }));
  });

export const importAnimeDocEpisodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ subjectId: z.string().trim().min(1).max(100), detailPath: z.string().min(1).max(1000), title: z.string().min(1).max(250), cover: z.string().url().nullable().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const animeId = Number(data.subjectId);
    if (!Number.isInteger(animeId) || animeId < 1) throw new Error("Invalid Jikan anime ID.");
    const db = context.supabase as any;
    const detail = await jikan<{ data: Anime }>("/anime/" + animeId);
    const anime = detail.data;
    const title = anime.title_english || anime.title || data.title;
    const cover = anime.images?.webp?.image_url || anime.images?.jpg?.image_url || data.cover || null;
    const episodeCount = anime.episodes ?? 0;
    if (episodeCount < 1) throw new Error("Jikan does not list an episode count for this anime, so no episode entries were created.");
    if (episodeCount > 2000) throw new Error("The reported episode count is unexpectedly high; import was stopped for safety.");
    const { data: existing, error: findError } = await db.from("series").select("id,import_locked").eq("title", title).maybeSingle();
    if (findError) throw new Error("Could not check the existing series: " + findError.message);
    let seriesId: string;
    let seriesAdded = false;
    if (existing) {
      seriesId = existing.id;
      if (!existing.import_locked) {
        const { error } = await db.from("series").update({ cover_url: cover, total_episodes: episodeCount }).eq("id", seriesId);
        if (error) throw new Error("Could not update series metadata: " + error.message);
      }
    } else {
      const { data: inserted, error } = await db.from("series").insert({ title, title_english: anime.title_english || title, cover_url: cover, total_episodes: episodeCount, type: "TV", status: "Unknown" }).select("id").single();
      if (error) throw new Error("Could not create series: " + error.message);
      seriesId = inserted.id;
      seriesAdded = true;
    }
    const { data: current, error: episodeError } = await db.from("episode_catalog").select("number").eq("series_id", seriesId);
    if (episodeError) throw new Error("Could not read the episode catalogue: " + episodeError.message);
    const known = new Set((current || []).map((row: { number: number }) => row.number));
    const rows: { series_id: string; number: number; season_number: number; season_episode_number: number; title: string; released: boolean }[] = [];
    let page = 1;
    let lastPage = 1;
    do {
      const response = await jikan<{ data: JikanEpisode[]; pagination?: { last_visible_page?: number } }>("/anime/" + animeId + "/episodes?page=" + page);
      lastPage = Math.min(response.pagination?.last_visible_page || 1, 80);
      for (const ep of response.data || []) {
        const number = Number(ep.episode);
        if (!Number.isInteger(number) || number < 1 || number > 2000 || known.has(number)) continue;
        rows.push({ series_id: seriesId, number, season_number: 1, season_episode_number: number, title: ep.title?.trim() || "Episode " + number, released: true });
        known.add(number);
      }
      page++;
      if (page <= lastPage) await new Promise((resolve) => setTimeout(resolve, 400));
    } while (page <= lastPage);
    if (rows.length) {
      const { error } = await db.from("episode_catalog").insert(rows);
      if (error) throw new Error("Series was saved, but episode import failed: " + error.message);
    }
    return { title, seriesAdded, episodesAdded: rows.length, episodeCount, seriesId, note: "Jikan provides anime and episode information, not video streams. Add an authorised video URL or upload a video separately for each playable episode." };
  });
