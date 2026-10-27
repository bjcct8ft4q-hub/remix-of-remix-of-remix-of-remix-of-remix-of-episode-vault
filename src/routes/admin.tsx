import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Trash2, Upload, LoaderCircle, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { seriesListQuery, seriesQuery } from "@/lib/queries";
import { mediaError, uploadMedia, withDeadline } from "@/lib/media";
import { uploadEpisodeVideos, validateEpisodeVideos, type AudioVersion } from "@/lib/episode-video";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Streamly" },
      { name: "description", content: "Manage series and upload episodes on Streamly." },
      { property: "og:title", content: "Admin — Streamly" },
      { property: "og:description", content: "Manage series and upload episodes on Streamly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const inputCls = "min-h-11 w-full min-w-0 rounded-md border border-border bg-muted/60 px-3 py-2.5 text-sm outline-none focus:border-primary file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-primary";
const L = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-semibold text-muted-foreground">{t}</span>
    {children}
  </label>
);

const seriesSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(3000),
  type: z.string().trim().max(20),
  start_date: z.string().optional(),
  premiered: z.string().trim().max(60),
  country: z.string().trim().max(60),
  status: z.string().trim().max(40),
  score: z.string().refine((v) => v === "" || (Number(v) >= 0 && Number(v) <= 10), "Score must be 0–10"),
  genres: z.string().max(500),
  studios: z.string().max(500),
});

const empty = { title: "", description: "", type: "TV", start_date: "", premiered: "", country: "", status: "Airing", score: "", genres: "", studios: "" };

function SeriesForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState(empty);
  const [cover, setCover] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = seriesSchema.safeParse(f);
    if (!p.success) return void toast.error(p.error.issues[0]?.message ?? "Invalid input");
    setBusy(true);
    try {
      const cover_url = cover ? await uploadMedia(cover, "covers") : null;
      const banner_url = banner ? await uploadMedia(banner, "banners") : null;
      const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      const { error } = await withDeadline(supabase.from("series").insert({
        title: p.data.title,
        description: p.data.description || null,
        type: p.data.type,
        start_date: p.data.start_date || null,
        premiered: p.data.premiered || null,
        country: p.data.country || null,
        status: p.data.status,
        score: p.data.score === "" ? null : Number(p.data.score),
        genres: split(p.data.genres),
        studios: split(p.data.studios),
        cover_url,
        banner_url,
      }).abortSignal(AbortSignal.timeout(30_000)));
      if (error) throw error;
      toast.success("Series added");
      setF(empty);
      setCover(null);
      setBanner(null);
      onDone();
    } catch (err) {
      toast.error(mediaError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-x-6 gap-y-5 border-y border-border py-7 md:grid-cols-2">
      <h2 className="text-xl font-extrabold md:col-span-2">Add a series</h2>
      <L t="Title"><input className={inputCls} value={f.title} onChange={set("title")} /></L>
      <L t="Type">
        <select className={inputCls} value={f.type} onChange={set("type")}>
          {["TV", "Movie", "ONA", "OVA", "Special"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </L>
      <div className="md:col-span-2"><L t="Description"><textarea rows={3} className={inputCls} value={f.description} onChange={set("description")} /></L></div>
      <L t="Start date"><input type="date" className={inputCls} value={f.start_date} onChange={set("start_date")} /></L>
      <L t="Premiered"><input className={inputCls} placeholder="Fall 2026" value={f.premiered} onChange={set("premiered")} /></L>
      <L t="Country"><input className={inputCls} placeholder="Japan" value={f.country} onChange={set("country")} /></L>
      <L t="Score (0–10)"><input type="number" step="0.1" min="0" max="10" className={inputCls} value={f.score} onChange={set("score")} /></L>
      <L t="Genres (comma separated)"><input className={inputCls} placeholder="Action, Fantasy" value={f.genres} onChange={set("genres")} /></L>
      <L t="Studios (comma separated)"><input className={inputCls} placeholder="Studio Pierrot" value={f.studios} onChange={set("studios")} /></L>
      <L t="Status">
        <select className={inputCls} value={f.status} onChange={set("status")}>
          {["Airing", "Finished", "Upcoming"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </L>
      <div />
      <L t="Cover art (portrait)"><input type="file" accept="image/*" className={inputCls} onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></L>
      <L t="Banner (wide, optional)"><input type="file" accept="image/*" className={inputCls} onChange={(e) => setBanner(e.target.files?.[0] ?? null)} /></L>
      <Button type="submit" disabled={busy} className="h-11 font-bold md:col-span-2 md:justify-self-start">
        {busy ? "Saving..." : "Add series"}
      </Button>
    </form>
  );
}

type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];
function EpisodeEditor({ episode, seriesId, taken, onDone }: { episode: EpisodeRow; seriesId: string; taken: number[]; onDone: () => void }) {
  const [num, setNum] = useState(String(episode.number));
  const [title, setTitle] = useState(episode.title ?? "");
  const [airDate, setAirDate] = useState(episode.air_date ?? "");
  const [sub, setSub] = useState<File | null>(null);
  const [dub, setDub] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [removeDub, setRemoveDub] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(num);
    if (!Number.isInteger(n) || n < 1) return void toast.error("Episode number must be a positive whole number");
    if (taken.includes(n)) return void toast.error(`Episode ${n} already exists.`);
    setBusy(true);
    const added: string[] = [];
    try {
      const patch: Partial<EpisodeRow> = { number: n, title: title.trim().slice(0, 200) || null, air_date: airDate || null };
      if (sub) { setProgress("Uploading sub video… 0%"); patch.video_path = await uploadMedia(sub, `videos/${seriesId}/sub`, { onProgress: (p) => setProgress(`Uploading sub video… ${p}%`) }); added.push(patch.video_path); }
      if (dub) { setProgress("Uploading dub video… 0%"); patch.dub_video_path = await uploadMedia(dub, `videos/${seriesId}/dub`, { onProgress: (p) => setProgress(`Uploading dub video… ${p}%`) }); added.push(patch.dub_video_path); }
      else if (removeDub) patch.dub_video_path = null;
      if (thumb) { setProgress("Uploading image…"); patch.thumbnail_path = await uploadMedia(thumb, `thumbs/${seriesId}`); added.push(patch.thumbnail_path); }
      setProgress("Saving…");
      const { error } = await withDeadline(supabase.from("episodes").update(patch).eq("id", episode.id).abortSignal(AbortSignal.timeout(30_000)));
      if (error) throw error;
      const old = [sub && episode.video_path, (dub || removeDub) && episode.dub_video_path, thumb && episode.thumbnail_path].filter((p): p is string => !!p);
      if (old.length) await supabase.storage.from("media").remove(old);
      toast.success(`Episode ${n} updated`);
      onDone();
    } catch (err) {
      if (added.length) await supabase.storage.from("media").remove(added).catch(() => {});
      toast.error(mediaError(err));
    } finally { setBusy(false); setProgress(null); }
  };

  return (
    <form onSubmit={save} className="mt-3 rounded-md border border-border bg-card/40 p-4">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-[100px_minmax(0,1fr)_180px]">
        <L t="Number"><input type="number" min="1" className={inputCls} value={num} onChange={(e) => setNum(e.target.value)} /></L>
        <L t="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></L>
        <L t="Air date"><input type="date" className={inputCls} value={airDate} onChange={(e) => setAirDate(e.target.value)} /></L>
        <L t="Replace sub video"><input type="file" accept="video/*" className={inputCls} onChange={(e) => setSub(e.target.files?.[0] ?? null)} /></L>
        <L t={episode.dub_video_path ? "Replace dub video" : "Add dub video"}><input type="file" accept="video/*" className={inputCls} onChange={(e) => setDub(e.target.files?.[0] ?? null)} /></L>
        <L t={episode.thumbnail_path ? "Replace episode image" : "Add episode image"}><input type="file" accept="image/*" className={inputCls} onChange={(e) => setThumb(e.target.files?.[0] ?? null)} /></L>
      </fieldset>
      {episode.dub_video_path && !dub && <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={removeDub} onChange={(e) => setRemoveDub(e.target.checked)} className="accent-primary" />Remove dub version</label>}
      {progress && <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">{progress}</p>}
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={busy} size="sm">{busy ? <LoaderCircle className="animate-spin" /> : null}Save changes</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function EpisodeManager({ seriesId }: { seriesId: string }) {
  const qc = useQueryClient();
  const { data: s } = useQuery(seriesQuery(seriesId));
  const [num, setNum] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dub, setDub] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [airDate, setAirDate] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [uploadVersion, setUploadVersion] = useState<AudioVersion>("sub");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const next = (s?.episodes.at(-1)?.number ?? 0) + 1;

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (controller.current) return;
    const form = e.currentTarget as HTMLFormElement;
    try { validateEpisodeVideos(file, dub); } catch (err) { return void toast.error(mediaError(err)); }
    if (!file) return;
    const n = Number(num || next);
    if (!Number.isInteger(n) || n < 1) return void toast.error("Episode number must be a positive whole number");
    if (s?.episodes.some((episode) => episode.number === n)) return void toast.error(`Episode ${n} already exists. Choose a different number.`);
    controller.current = new AbortController();
    setProgress(0);
    setStatus(null);
    setBusy(true);
    const uploadedPaths: string[] = [];
    try {
      const { video_path, dub_video_path } = await uploadEpisodeVideos(file, dub, seriesId, { onProgress: setProgress, signal: controller.current.signal, onVersion: setUploadVersion, onUploaded: (path) => uploadedPaths.push(path) });
      const thumbnail_path = thumbFile ? await uploadMedia(thumbFile, `thumbs/${seriesId}`, { signal: controller.current.signal }) : null;
      if (thumbnail_path) uploadedPaths.push(thumbnail_path);
      setSaving(true);
      const { error } = await withDeadline(supabase.from("episodes").insert({ series_id: seriesId, number: n, title: title.trim().slice(0, 200) || null, video_path, dub_video_path, thumbnail_path, air_date: airDate || null }).abortSignal(AbortSignal.timeout(30_000)));
      if (error) throw error;
      toast.success(`Episode ${n} uploaded`);
      setStatus({ kind: "success", message: `Episode ${n} uploaded successfully.` });
      setNum("");
      setTitle("");
      setFile(null);
      setDub(null);
      form.reset();
      qc.invalidateQueries({ queryKey: ["series"] });
    } catch (err) {
      let message = mediaError(err);
      const uploadedPath = uploadedPaths[0];
      if (uploadedPath) {
        // A response timeout may hide a successful insert. Never delete a referenced video.
        try {
          const check = await withDeadline(supabase.from("episodes").select("id").eq("video_path", uploadedPath).abortSignal(AbortSignal.timeout(30_000)));
          if (check.error) throw check.error;
          if (check.data?.length) {
            message = "The video was saved, but confirmation was interrupted. Refresh the episode list before retrying.";
            qc.invalidateQueries({ queryKey: ["series"] });
          } else {
            const cleanup = await withDeadline(supabase.storage.from("media").remove(uploadedPaths));
            if (cleanup.error) throw cleanup.error;
          }
        } catch {
          message += " The video may still be stored; refresh the episode list before retrying.";
        }
      }
      setStatus({ kind: "error", message });
      toast.error(message);
    } finally {
      setBusy(false);
      setSaving(false);
      controller.current = null;
    }
  };

  const delEp = async (id: string, path: string, dubPath: string | null) => {
    if (!confirm("Delete this episode?")) return;
    try {
      const { error } = await withDeadline(supabase.from("episodes").delete().eq("id", id).abortSignal(AbortSignal.timeout(30_000)));
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["series"] });
      const cleanup = await withDeadline(supabase.storage.from("media").remove(dubPath ? [path, dubPath] : [path]));
      if (cleanup.error) toast.error("Episode deleted, but its video files could not be removed.");
    } catch (err) { toast.error(mediaError(err)); }
  };

  return (
    <section className="min-w-0 space-y-5 border-t border-border pt-7">
      <h2 className="break-words text-xl font-extrabold">Episodes — {s?.title}</h2>
      <form onSubmit={upload} className="space-y-4">
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-[100px_minmax(0,1fr)]">
        <L t="Number"><input type="number" min="1" className={inputCls} placeholder={String(next)} value={num} onChange={(e) => setNum(e.target.value)} /></L>
        <L t="Title (optional)"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></L>
        <div className="sm:col-span-2"><L t="Sub video (required)"><input type="file" required accept="video/*" className={inputCls} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></L></div>
        <div className="sm:col-span-2"><L t="Dub video (optional)"><input type="file" accept="video/*" className={inputCls} onChange={(e) => setDub(e.target.files?.[0] ?? null)} /></L></div>
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
          <L t="Episode image (optional)"><input type="file" accept="image/*" className={inputCls} onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)} /></L>
          <L t="Air date (optional)"><input type="date" className={inputCls} value={airDate} onChange={(e) => setAirDate(e.target.value)} /></L>
        </div>
      </fieldset>
      {busy && <div className="space-y-2" aria-live="polite"><Progress value={progress} aria-label="Video upload progress" /><p className="text-sm text-muted-foreground">{saving ? "Saving episode…" : `Uploading ${uploadVersion} video… ${progress}%`}</p></div>}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy} className="h-11 font-bold">
          {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Upload />} {busy ? "Uploading…" : "Upload"}
        </Button>
        {busy && !saving && <Button type="button" variant="outline" className="h-11" onClick={() => controller.current?.abort()}>Cancel</Button>}
      </div>
      {status && <p role={status.kind === "error" ? "alert" : "status"} className={`break-words text-sm ${status.kind === "error" ? "text-destructive" : "text-primary"}`}>{status.message}</p>}
      </form>
      <ul className="divide-y divide-border">
        {s?.episodes.map((e) => (
          <li key={e.id} className="py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <Link to="/watch/$episodeId" params={{ episodeId: e.id }} className="min-w-0 break-words hover:text-primary">EP {e.number} {e.title && `· ${e.title}`} <span className="ml-2 text-xs text-primary">SUB{e.dub_video_path ? " · DUB" : ""}{e.thumbnail_path ? " · IMG" : ""}</span></Link>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" aria-label="Edit episode" title="Edit episode" aria-expanded={editing === e.id} onClick={() => setEditing(editing === e.id ? null : e.id)} className="text-muted-foreground hover:text-primary"><Pencil /></Button>
                <Button variant="ghost" size="icon" aria-label="Delete episode" title="Delete episode" onClick={() => delEp(e.id, e.video_path, e.dub_video_path)} className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>
              </div>
            </div>
            {editing === e.id && <EpisodeEditor episode={e} seriesId={seriesId} taken={s.episodes.filter((x) => x.id !== e.id).map((x) => x.number)} onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["series"] }); qc.invalidateQueries({ queryKey: ["episode", e.id] }); }} />}
          </li>
        ))}
      </ul>
      {!s?.episodes.length && <p className="text-sm text-muted-foreground">No episodes uploaded yet.</p>}
    </section>
  );
}

function Admin() {
  const { user, isAdmin, loading, openAuth } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ ...seriesListQuery(), enabled: isAdmin });
  const [selected, setSelected] = useState<string | null>(null);

  if (loading) return <main className="pt-32 text-center text-muted-foreground">Loading...</main>;
  if (!user)
    return (
      <main className="pt-32 text-center">
        <p className="mb-4">Sign in with an admin account to continue.</p>
        <Button onClick={() => openAuth("signin")}>Sign in</Button>
      </main>
    );
  if (!isAdmin) return <main className="pt-32 text-center text-muted-foreground">This account isn't an admin.</main>;

  const delSeries = async (id: string) => {
    if (!confirm("Delete this series and all its episodes?")) return;
    const { error } = await supabase.from("series").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    if (selected === id) setSelected(null);
    qc.invalidateQueries({ queryKey: ["series"] });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 pb-20 pt-40 sm:px-6 md:pt-28">
      <h1 className="border-l-4 border-primary pl-3 text-3xl font-extrabold">Admin dashboard</h1>
      <SeriesForm onDone={() => qc.invalidateQueries({ queryKey: ["series"] })} />
      <div className="min-w-0">
        <h2 className="mb-3 text-xl font-extrabold">Your series</h2>
        <ul className="divide-y divide-border">
          {data.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 break-words font-semibold">{s.title} <span className="text-xs text-muted-foreground">· {s.episodes?.[0]?.count ?? 0} eps</span></span>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" onClick={() => setSelected(s.id)} variant={selected === s.id ? "default" : "outline"}>Manage episodes</Button>
                <Button variant="ghost" size="icon" aria-label="Delete series" title="Delete series" onClick={() => delSeries(s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>
              </div>
            </li>
          ))}
          {!data.length && <p className="text-sm text-muted-foreground">No series yet — add one above.</p>}
        </ul>
      </div>
      {selected && <EpisodeManager key={selected} seriesId={selected} />}
    </main>
  );
}
