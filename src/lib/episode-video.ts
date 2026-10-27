import { uploadMedia } from "@/lib/media";

export type AudioVersion = "sub" | "dub";
export function episodeVideoPath(episode: { video_path: string; dub_video_path?: string | null }, version: AudioVersion) {
  return version === "dub" && episode.dub_video_path ? episode.dub_video_path : episode.video_path;
}

export function validateEpisodeVideos(sub: File | null, dub: File | null) {
  if (!sub) throw new Error("Choose a subtitled video file.");
  for (const file of [sub, dub]) {
    if (!file) continue;
    if (!file.size) throw new Error("The selected video is empty.");
    if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(file.name)) throw new Error("Choose a video file, such as MP4 or WebM.");
  }
}

export async function uploadEpisodeVideos(sub: File, dub: File | null, seriesId: string, options: { signal: AbortSignal; onProgress: (progress: number) => void; onVersion: (version: AudioVersion) => void; onUploaded: (path: string) => void }) {
  validateEpisodeVideos(sub, dub);
  const total = sub.size + (dub?.size ?? 0);
  options.onVersion("sub");
  const video_path = await uploadMedia(sub, `videos/${seriesId}/sub`, { signal: options.signal, onProgress: (p) => options.onProgress(Math.round(p * sub.size / total)) });
  options.onUploaded(video_path);
  let dub_video_path: string | null = null;
  if (dub) {
    options.onVersion("dub");
    dub_video_path = await uploadMedia(dub, `videos/${seriesId}/dub`, { signal: options.signal, onProgress: (p) => options.onProgress(Math.round((sub.size * 100 + p * dub.size) / total)) });
    options.onUploaded(dub_video_path);
  }
  return { video_path, dub_video_path };
}