import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Anime = { mal_id: number; title?: string; title_english?: string | null; episodes?: number | null; year?: number | null; aired?: { prop?: { from?: { year?: number | null } } }; images?: { jpg?: { image_url?: string | null }; webp?: { image_url?: string | null } } };
type JikanEpisode = { episode?: string | null; title?: string | null };
async function jikan<T>(path: string): Promise<T> {
  const response = await fetch("https://api.tenrai.org/v1" + path, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (response.status === 429) throw new Error("Tenrai is rate-limiting requests. Please wait briefly, then try again.");
  if (!response.ok) throw new Error("Tenrai returned HTTP " + response.status + ".");
  return response.json() as Promise<T>;
}
async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Admins only");
}

// Keep the existing exported names so the current import panel remains compatible; requests now use Tenrai.
export const searchAnimeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ query: z.string().trim().min(1).max(160) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const result = await jikan<{ data: Anime[] }>("/anime?q=" + encodeURIComponent(data.query) + "&limit=10&order_by=title&sort=asc");
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
    if (!Number.isInteger(animeId) || animeId < 1) throw new Error("Invalid Tenrai anime ID.");
    const db = context.supabase as any;
    const detail = await jikan<{ data: Anime }>("/anime/" + animeId);
    const anime = detail.data;
    const title = anime.title_english || anime.title || data.title;
    const cover = anime.images?.webp?.image_url || anime.images?.jpg?.image_url || data.cover || null;
    const episodeCount = anime.episodes ?? 0;
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
    let discoveredEpisodeCount = episodeCount;
    do {
      const response = await jikan<{ data: JikanEpisode[]; pagination?: { last_visible_page?: number; items?: { total?: number } } }>("/anime/" + animeId + "/episodes?page=" + page);
      discoveredEpisodeCount = Math.max(discoveredEpisodeCount, response.pagination?.items?.total || 0);
      lastPage = Math.min(response.pagination?.last_visible_page || 1, 500);
      for (const ep of response.data || []) {
        const number = Number(ep.episode);
        if (!Number.isInteger(number) || number < 1 || number > 2000 || known.has(number)) continue;
        rows.push({ series_id: seriesId, number, season_number: 1, season_episode_number: number, title: ep.title?.trim() || "Episode " + number, released: true });
        known.add(number);
      }
      page++;
      if (page <= lastPage) await new Promise((resolve) => setTimeout(resolve, 400));
    } while (page <= lastPage);
    // Some catalogue providers expose a total episode count but omit individual episode
    // records. Fill any gaps with numbered placeholders so the catalogue remains usable.
    // These are metadata entries only; they do not include or imply video streams.
    for (let number = 1; number <= discoveredEpisodeCount; number++) {
      if (number > 2000) break;
      if (known.has(number)) continue;
      rows.push({
        series_id: seriesId,
        number,
        season_number: 1,
        season_episode_number: number,
        title: "Episode " + number,
        released: true,
      });
      known.add(number);
    }
    if (rows.length) {
      const { error } = await db.from("episode_catalog").insert(rows);
      if (error) throw new Error("Series was saved, but episode import failed: " + error.message);
    }
    const finalEpisodeCount = Math.max(discoveredEpisodeCount, ...Array.from(known));

    // Optional automatic playback integration for a video service the site owner is
    // authorized to use. Configure STREAMLY_AUTHORIZED_EMBED_TEMPLATE on the server
    // with {malId} and {episode} placeholders. No third-party stream is guessed.
    let playableEpisodesAdded = 0;
    const embedTemplate = process.env.STREAMLY_AUTHORIZED_EMBED_TEMPLATE?.trim();
    if (embedTemplate) {
      if (!embedTemplate.includes("{malId}") || !embedTemplate.includes("{episode}")) {
        throw new Error("STREAMLY_AUTHORIZED_EMBED_TEMPLATE must include {malId} and {episode} placeholders.");
      }
      if (!/^https:\/\//i.test(embedTemplate)) {
        throw new Error("STREAMLY_AUTHORIZED_EMBED_TEMPLATE must use HTTPS.");
      }
      const playableRows = [];
      for (let number = 1; number <= finalEpisodeCount && number <= 2000; number++) {
        const url = embedTemplate
          .replaceAll("{malId}", String(animeId))
          .replaceAll("{episode}", String(number));
        let parsed: URL;
        try { parsed = new URL(url); } catch { throw new Error("The configured authorized embed template produced an invalid URL."); }
        if (parsed.protocol !== "https:") throw new Error("The configured embed template must generate HTTPS URLs.");
        const catalogEpisode = rows.find((row) => row.number === number);
        playableRows.push({
          series_id: seriesId,
          number,
          title: catalogEpisode?.title || "Episode " + number,
          air_date: null,
          thumbnail_path: cover,
          video_path: url,
        });
      }
      if (playableRows.length) {
        const { data: existingPlayable, error: playableLookupError } = await db
          .from("episodes").select("id,number").eq("series_id", seriesId);
        if (playableLookupError) throw new Error("Episodes were imported, but existing playable entries could not be checked: " + playableLookupError.message);
        const playableByNumber = new Map((existingPlayable || []).map((row: {id:string;number:number}) => [row.number, row.id]));
        for (const item of playableRows) {
          const existingId = playableByNumber.get(item.number);
          const result = existingId
            ? await db.from("episodes").update({ title: item.title, video_path: item.video_path }).eq("id", existingId)
            : await db.from("episodes").insert(item);
          if (result.error) throw new Error("Episode metadata imported, but automatic authorized player setup failed for episode " + item.number + ": " + result.error.message);
          playableEpisodesAdded++;
        }
      }
    }
    if (finalEpisodeCount > 0) {
      const { error } = await db.from("series").update({ total_episodes: finalEpisodeCount }).eq("id", seriesId);
      if (error) throw new Error("Episodes were imported, but the total episode count could not be updated: " + error.message);
    }
    if (rows.length === 0 && known.size === 0) throw new Error("Tenrai returned no episode records for this anime. Its metadata was saved, but no episode entries were available to import.");
    return {
      title, seriesAdded, episodesAdded: rows.length, episodeCount: finalEpisodeCount, seriesId, playableEpisodesAdded,
      note: embedTemplate
        ? `Automatic authorized player URLs were configured for ${playableEpisodesAdded} episode entries. Confirm your provider grants playback rights and supports these URLs.`
        : "Episode information was imported. To automate playback, configure STREAMLY_AUTHORIZED_EMBED_TEMPLATE on the server with your authorized provider's URL pattern, using {malId} and {episode}. Without that setting, Streamly will not invent video sources.",
    };
  });

// Attach a stream URL that the site owner is authorised to use to an imported catalogue episode.
// Direct MP4/WebM and HLS (.m3u8) URLs are supported by the existing player.
export const attachEpisodeStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    seriesId: z.string().uuid(),
    episodeNumber: z.number().int().min(1).max(2000),
    videoUrl: z.string().trim().url().max(4000),
    title: z.string().trim().max(250).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const url = new URL(data.videoUrl);
    if (url.protocol !== "https:") throw new Error("Use a secure HTTPS video URL.");
    const db = context.supabase as any;
    const { data: series, error: seriesError } = await db.from("series").select("id,title").eq("id", data.seriesId).maybeSingle();
    if (seriesError) throw new Error("Could not find the series: " + seriesError.message);
    if (!series) throw new Error("Series not found.");
    const { data: catalog, error: catalogError } = await db.from("episode_catalog").select("title,air_date,thumbnail_path,released").eq("series_id", data.seriesId).eq("number", data.episodeNumber).maybeSingle();
    if (catalogError) throw new Error("Could not find the catalogue episode: " + catalogError.message);
    if (!catalog) throw new Error("Import this episode into the catalogue first.");
    if (!catalog.released) throw new Error("This episode is not marked as released yet.");
    const { data: existing, error: existingError } = await db.from("episodes").select("id").eq("series_id", data.seriesId).eq("number", data.episodeNumber).maybeSingle();
    if (existingError) throw new Error("Could not check existing playable episode: " + existingError.message);
    const values = {
      series_id: data.seriesId,
      number: data.episodeNumber,
      title: data.title?.trim() || catalog.title || "Episode " + data.episodeNumber,
      air_date: catalog.air_date,
      thumbnail_path: catalog.thumbnail_path,
      video_path: url.toString(),
    };
    if (existing) {
      const { error } = await db.from("episodes").update(values).eq("id", existing.id);
      if (error) throw new Error("Could not update the playable episode: " + error.message);
    } else {
      const { error } = await db.from("episodes").insert(values);
      if (error) throw new Error("Could not create the playable episode: " + error.message);
    }
    return { title: series.title, episodeNumber: data.episodeNumber, updated: !!existing };
  });
