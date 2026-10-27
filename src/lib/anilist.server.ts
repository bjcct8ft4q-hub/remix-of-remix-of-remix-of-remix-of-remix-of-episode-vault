import { supabaseAdmin as db } from "@/integrations/supabase/client.server";

const QUERY = `query($sort:[MediaSort],$status:MediaStatus){Page(perPage:50){media(type:ANIME,sort:$sort,status:$status,isAdult:false){id title{english romaji native} description(asHtml:false) coverImage{extraLarge} bannerImage genres averageScore status episodes format season seasonYear startDate{year month day} countryOfOrigin studios(isMain:true){nodes{name}} nextAiringEpisode{episode}}}}`;
const SELECTIONS = {
  trending: { sort: ["TRENDING_DESC"], status: null },
  popular: { sort: ["POPULARITY_DESC"], status: null },
  upcoming: { sort: ["POPULARITY_DESC"], status: "NOT_YET_RELEASED" },
  airing: { sort: ["POPULARITY_DESC"], status: "RELEASING" },
} as const;
const STATUS: Record<string, string> = { RELEASING: "Airing", FINISHED: "Finished", NOT_YET_RELEASED: "Upcoming" };

type Media = {
  id: number; title: { english: string | null; romaji: string | null; native: string | null }; description: string | null;
  coverImage: { extraLarge: string | null }; bannerImage: string | null; genres: string[]; averageScore: number | null;
  status: string; episodes: number | null; format: string | null; season: string | null; seasonYear: number | null;
  startDate: { year: number | null; month: number | null; day: number | null }; countryOfOrigin: string | null;
  studios: { nodes: { name: string }[] }; nextAiringEpisode: { episode: number } | null;
};


export async function importCore(data: { selection: keyof typeof SELECTIONS }) {
  const { data: claimed } = await db.rpc("claim_import_run");
  if (!claimed) throw new Error("An import is already running or AniList asked us to wait. Try again shortly.");
  const { data: run } = await db.from("import_runs").insert({ selection: data.selection }).select("id").single();
  let seriesAdded = 0, episodesAdded = 0;
  try {
    const key = `anilist:${data.selection}`;
    const { data: cached } = await db.from("import_cache").select("response").eq("key", key).gt("expires_at", new Date().toISOString()).maybeSingle();
    let media: Media[];
    if (cached) media = cached.response as unknown as Media[];
    else {
      const res = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ query: QUERY, variables: { sort: SELECTIONS[data.selection].sort, status: SELECTIONS[data.selection].status } }), signal: AbortSignal.timeout(20_000) });
      if (res.status === 429) {
        const wait = Number(res.headers.get("retry-after") ?? 60);
        await db.from("import_settings").update({ retry_after: new Date(Date.now() + wait * 1000).toISOString() }).eq("id", true);
        throw new Error(`AniList rate limit reached. Retry in ${wait}s.`);
      }
      if (!res.ok) throw new Error(`AniList returned ${res.status}`);
      const json = (await res.json()) as { data?: { Page: { media: Media[] } }; errors?: { message: string }[] };
      if (!json.data) throw new Error(json.errors?.[0]?.message ?? "AniList returned no data");
      media = json.data.Page.media;
      await db.from("import_cache").upsert({ key, response: media as never, expires_at: new Date(Date.now() + 3600_000).toISOString() });
    }
    for (const m of media) {
      const d = m.startDate;
      const fields = {
        title: m.title.english || m.title.romaji || m.title.native || `AniList ${m.id}`,
        title_english: m.title.english, title_japanese: m.title.native,
        description: m.description?.replace(/<[^>]+>/g, "").slice(0, 3000) ?? null,
        cover_url: m.coverImage.extraLarge, banner_url: m.bannerImage, genres: m.genres ?? [],
        studios: m.studios.nodes.map((s) => s.name), score: m.averageScore != null ? m.averageScore / 10 : null,
        status: STATUS[m.status] ?? m.status, type: m.format === "MOVIE" ? "Movie" : m.format ?? "TV",
        premiered: m.season && m.seasonYear ? `${m.season[0]}${m.season.slice(1).toLowerCase()} ${m.seasonYear}` : null,
        start_date: d.year && d.month && d.day ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : null,
        country: m.countryOfOrigin === "JP" ? "Japan" : m.countryOfOrigin, total_episodes: m.episodes,
      };
      const { data: existing } = await db.from("series").select("id, import_locked").eq("anilist_id", m.id).maybeSingle();
      let seriesId = existing?.id;
      if (!existing) {
        const { data: ins, error } = await db.from("series").insert({ ...fields, anilist_id: m.id }).select("id").single();
        if (error) throw error;
        seriesId = ins.id; seriesAdded++;
      } else if (!existing.import_locked) {
        await db.from("series").update(fields).eq("id", existing.id);
      }
      // Announced episodes: known total; released: below the next airing episode (or all if finished).
      const total = m.episodes ?? (m.nextAiringEpisode ? m.nextAiringEpisode.episode : 0);
      const released = m.status === "FINISHED" ? total : m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : 0;
      if (!seriesId || total < 1) continue;
      const { data: have } = await db.from("episode_catalog").select("number, import_locked").eq("series_id", seriesId);
      const known = new Map((have ?? []).map((e) => [e.number, e.import_locked]));
      const rows = [];
      for (let n = 1; n <= Math.min(total, 2000); n++) if (!known.has(n)) rows.push({ series_id: seriesId, number: n, released: n <= released });
      if (rows.length) { await db.from("episode_catalog").insert(rows); episodesAdded += rows.length; }
      const unlocked = [...known].filter(([n, l]) => !l && n <= released).map(([n]) => n);
      if (unlocked.length) await db.from("episode_catalog").update({ released: true }).eq("series_id", seriesId).in("number", unlocked);
    }
    const now = new Date().toISOString();
    await db.from("import_runs").update({ status: "success", finished_at: now, series_added: seriesAdded, episodes_added: episodesAdded }).eq("id", run!.id);
    await db.from("import_settings").update({ last_success_at: now, lock_until: null }).eq("id", true);
    return { seriesAdded, episodesAdded, processed: media.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("import_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: msg, series_added: seriesAdded, episodes_added: episodesAdded }).eq("id", run!.id);
    await db.from("import_settings").update({ lock_until: null }).eq("id", true);
    throw new Error(msg);
  }
}
