import { afterEach, describe, expect, it, vi } from "vitest";

const { uploadConfig, getSession, abort } = vi.hoisted(() => ({
  uploadConfig: { current: null as any },
  getSession: vi.fn(),
  abort: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession } } }));
vi.mock("tus-js-client", () => ({ Upload: class {
  constructor(_file: File, config: any) { uploadConfig.current = config; }
  start() {}
  abort = abort;
} }));
import { uploadMedia, withDeadline } from "@/lib/media";

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); uploadConfig.current = null; });
const video = () => new File(["video"], "episode.mp4", { type: "video/mp4" });
const session = () => getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } }, error: null });

describe("Media uploads", () => {
  it("reports progress and returns the stored path only after completion", async () => {
    session();
    const progress = vi.fn();
    const result = uploadMedia(video(), "videos/series", { onProgress: progress });
    await vi.waitFor(() => expect(uploadConfig.current).not.toBeNull());
    uploadConfig.current.onProgress(2, 4);
    expect(progress).toHaveBeenCalledWith(50);
    uploadConfig.current.onSuccess();
    expect(await result).toMatch(/^videos\/series\/.*\.mp4$/);
  });
  it("rejects storage failures instead of staying busy", async () => {
    session();
    const result = uploadMedia(video(), "videos/series");
    const assertion = expect(result).rejects.toThrow("permission was denied");
    await vi.waitFor(() => expect(uploadConfig.current).not.toBeNull());
    uploadConfig.current.onError(new Error("403 Unauthorized"));
    await assertion;
  });
  it("supports cancelling a transfer", async () => {
    session();
    const controller = new AbortController();
    const result = uploadMedia(video(), "videos/series", { signal: controller.signal });
    const assertion = expect(result).rejects.toThrow("Upload cancelled");
    await vi.waitFor(() => expect(uploadConfig.current).not.toBeNull());
    controller.abort();
    await assertion;
    expect(abort).toHaveBeenCalled();
  });
  it("rejects an expired session before uploading", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(uploadMedia(video(), "videos/series")).rejects.toThrow("session has expired");
  });
  it("rejects empty files", async () => {
    await expect(uploadMedia(new File([], "empty.mp4"), "videos/series")).rejects.toThrow("empty");
  });
  it("times out stalled requests", async () => {
    vi.useFakeTimers();
    const result = withDeadline(new Promise(() => {}), 30_000);
    const assertion = expect(result).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });
  it("stops an upload after two minutes without progress", async () => {
    vi.useFakeTimers();
    session();
    const result = uploadMedia(video(), "videos/series");
    const assertion = expect(result).rejects.toThrow("No upload progress for two minutes");
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
    expect(abort).toHaveBeenCalled();
  });
});