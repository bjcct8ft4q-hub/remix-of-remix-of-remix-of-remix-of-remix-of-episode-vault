import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type UnknownRecord = Record<string, unknown>;
function records(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter((v): v is UnknownRecord => !!v && typeof v === "object");
  if (value && typeof value === "object") {
    const obj = value as UnknownRecord;
    for (const key of ["data", "results", "items", "list", "animes", "subjects"]) {
      const found = records(obj[key]);
      if (found.length) return found;
    }
  }
  return [];
}
function str(...values: unknown[]): string {
  const v = values.find((x) => (typeof x === "string" && x.trim()) || (typeof x === "number" && Number.isFinite(x)));
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}
function num(...values: unknown[]): number | null {
  const v = values.find((x) => typeof x === "number" && Number.isFinite(x));
  return typeof v === "number" ? v : null;
}
function imageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}
async function animeDoc<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  const key = process.env.ANIMEDOC_API_KEY;
  if (!key) throw new Error("AnimeDoc is not configured. Add ANIMEDOC_API_KEY to Vercel Environment Variables, then redeploy.");
  const url = new URL(path, "https://api.animedoc.cloud");
  const response = await fetch(url, {
    method,
    headers: { "X-API-Key": key, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401 || response.status === 403) throw new Error("AnimeDoc rejected the API key or this endpoint is not enabled for your plan.");
  if (response.status === 429) throw new Error("AnimeDoc rate limit reached. Wait a moment and try again.");
  if (!response.ok) throw new Error(`AnimeDoc returned HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}

export const searchAnimeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ query: z.string().trim().min(1).max(160) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const json = await animeDoc<unknown>("/api/v2/anime/search/", "POST", { keyword: data.query, page: 1, perPage: 10, subjectType: 0 });
    return records(json).map((item) => ({
      subjectId: str(item.subjectId, item.subject_id, item.id, item.subjectID),
      detailPath: str(item.detailPath, item.detail_path, item.path),
      title: str(item.title, item.name, item.nameEn, item.titleEnglish, item.title_english) || "Untitled anime",
      year: num(item.year, item.releaseYear, item.release_year),
      cover: imageUrl(item.cover || item.coverUrl || item.cover_url || item.image || item.poster),
      episodeCount: num(item.episodeCount, item.episode_count, item.episodes) ?? 0,
    })).filter((item) => item.detailPath && item.subjectId);
  });

export const importAnimeDocEpisodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    subjectId: z.string().trim().min(1).max(100),
    detailPath: z.string().min(1).max(1000),
    title: z.string().min(1).max(250),
    cover: z.string().url().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const db = context.supabase as any;
    const detail = await animeDoc<unknown>(`/api/v2/anime/detail/?${new URLSearchParams({ detailPath: data.detailPath })}`);
    const root = (detail && typeof detail === "object" ? detail : {}) as UnknownRecord;
    const dataNode = root.data && typeof root.data === "object" ? root.data as UnknownRecord : root;
    const subject = dataNode.subject && typeof dataNode.subject === "object" ? dataNode.subject as UnknownRecord : dataNode;
    const resource = dataNode.resource && typeof dataNode.resource === "object" ? dataNode.resource as UnknownRecord : {};
    const rawSeasons = Array.isArray(resource.seasons) ? resource.seasons as UnknownRecord[] : [];
    const seasons = rawSeasons.map((season, index) => ({
      season: num(season.se, season.season, season.seasonNumber) ?? index + 1,
      count: num(season.maxEp, season.max_ep, season.episodeCount, season.episode_count) ?? 0,
    })).filter((season) => season.count > 0 && season.count <= 2000);
    const title = str(subject.title, subject.name, subject.nameEn, dataNode.title, data.title) || data.title;
    const rawCover = subject.cover && typeof subject.cover === "object" ? (subject.cover as UnknownRecord).url : subject.cover;
    const cover = imageUrl(typeof rawCover === "string" ? rawCover : null) ||
      imageUrl(subject.coverUrl || subject.cover_url || subject.image || subject.poster) || data.cover || null;
    const episodeCount = seasons.length
      ? seasons.reduce((total, season) => total + season.count, 0)
      : num(subject.episodeCount, subject.episode_count, subject.totalEpisodes, subject.total_episodes, subject.episodes,
          dataNode.episodeCount, dataNode.episode_count, dataNode.totalEpisodes, dataNode.total_episodes) ?? 0;
    if (episodeCount < 1) throw new Error("AnimeDoc returned the title details, but its resource.seasons list did not contain usable maxEp episode counts. No catalogue rows were changed.");
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
      const { data: inserted, error } = await db.from("series").insert({
        title, title_english: title, cover_url: cover, total_episodes: episodeCount, type: "TV", status: "Unknown",
      }).select("id").single();
      if (error) throw new Error("Could not create series: " + error.message);
      seriesId = inserted.id;
      seriesAdded = true;
    }
    const { data: current, error: episodeError } = await db.from("episode_catalog").select("number,import_locked").eq("series_id", seriesId);
    if (episodeError) throw new Error("Could not read the episode catalogue: " + episodeError.message);
    const known = new Map((current ?? []).map((row: { number: number; import_locked: boolean }) => [row.number, row.import_locked]));
    const rows = [];
    let globalNumber = 0;
    const seasonPlan = seasons.length ? seasons : [{ season: 1, count: episodeCount }];
    for (const season of seasonPlan) {
      for (let ep = 1; ep <= season.count; ep++) {
        globalNumber++;
        if (!known.has(globalNumber)) rows.push({
          series_id: seriesId,
          number: globalNumber,
          season_number: season.season,
          season_episode_number: ep,
          title: `Episode ${ep}`,
          released: true,
        });
      }
    }
    if (rows.length) {
      const { error } = await db.from("episode_catalog").insert(rows);
      if (error) throw new Error("Series was saved, but episode import failed: " + error.message);
    }
    return { title, seriesAdded, episodesAdded: rows.length, episodeCount, seriesId, note: "AnimeDoc detail endpoint did not provide per-episode titles in a recognized field; generic episode labels were used. Video source URLs are not saved by this catalogue import." };
  });
