import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "tus-js-client";

export async function withDeadline<T>(operation: PromiseLike<T>, milliseconds = 30_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("The request timed out. Check your connection and try again.")), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function mediaError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "Upload failed. Please try again.";
  if (/413|maximum.*size|size.*limit|too large/i.test(message)) return "This file exceeds the storage upload limit. Try a smaller video file.";
  if (/401|403|row.level|unauthorized/i.test(message)) return "Upload permission was denied. Sign in again with an admin account.";
  if (/network|fetch|offline/i.test(message)) return "The connection was interrupted. Check your internet connection and retry the upload.";
  return message;
}

export function useSignedUrl(path: string | null | undefined) {
  const q = useQuery({
    queryKey: ["signed", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 50,
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data } = await supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 6);
      return data?.signedUrl ?? null;
    },
  });
  return q.data ?? null;
}

export async function uploadMedia(file: File, folder: string, options: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {}) {
  if (!file.size) throw new Error("The selected file is empty. Choose another file.");
  const ext = file.name.split(".").pop() || "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await withDeadline(supabase.auth.getSession());
  if (error) throw error;
  if (!data.session) throw new Error("Your session has expired. Sign in again to upload.");
  if (options.signal?.aborted) throw new Error("Upload cancelled.");
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      options.signal?.removeEventListener("abort", cancel);
      if (error) {
        void upload.abort().catch(() => {});
        reject(error);
      } else resolve();
    };
    const resetWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => finish(new Error("No upload progress for two minutes. Check your connection and retry.")), 120_000);
    };
    const cancel = () => finish(new Error("Upload cancelled."));
    const upload = new Upload(file, {
      endpoint: `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/upload/resumable`,
      headers: {
        authorization: `Bearer ${data.session.access_token}`,
        apikey: import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'],
        "x-upsert": "false",
      },
      metadata: { bucketName: "media", objectName: path, contentType: file.type || "application/octet-stream", cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: false,
      onProgress: (sent, total) => {
        resetWatchdog();
        options.onProgress?.(Math.min(100, Math.round(sent / total * 100)));
      },
      onError: (error) => finish(new Error(mediaError(error))),
      onSuccess: () => finish(),
    });
    options.signal?.addEventListener("abort", cancel, { once: true });
    resetWatchdog();
    upload.start();
  });
  return path;
}
