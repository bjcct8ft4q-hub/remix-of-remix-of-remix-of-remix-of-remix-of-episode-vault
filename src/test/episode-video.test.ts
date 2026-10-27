import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/media", () => ({ uploadMedia: vi.fn() }));
import { uploadMedia } from "@/lib/media";
import { episodeVideoPath, uploadEpisodeVideos, validateEpisodeVideos } from "@/lib/episode-video";
const sub = new File(["sub"], "sub.mp4", { type: "video/mp4" });
const dub = new File(["dub"], "dub.mp4", { type: "video/mp4" });
const options = () => ({ signal: new AbortController().signal, onProgress: vi.fn(), onVersion: vi.fn(), onUploaded: vi.fn() });
beforeEach(() => vi.resetAllMocks());
describe("Episode audio versions", () => {
  it("requires a subtitled video even if a dub is provided", () => {
    expect(() => validateEpisodeVideos(null, dub)).toThrow("Choose a subtitled video");
  });
  it("uploads a sub without requiring a dub", async () => {
    vi.mocked(uploadMedia).mockResolvedValue("sub-path");
    expect(await uploadEpisodeVideos(sub, null, "series", options())).toEqual({ video_path: "sub-path", dub_video_path: null });
    expect(uploadMedia).toHaveBeenCalledTimes(1);
  });
  it("stores both versions when an optional dub is supplied", async () => {
    vi.mocked(uploadMedia).mockResolvedValueOnce("sub-path").mockResolvedValueOnce("dub-path");
    const callbacks = options();
    expect(await uploadEpisodeVideos(sub, dub, "series", callbacks)).toEqual({ video_path: "sub-path", dub_video_path: "dub-path" });
    expect(callbacks.onUploaded.mock.calls).toEqual([["sub-path"], ["dub-path"]]);
  });
  it("plays the uploaded dub when dub is selected", () => {
    expect(episodeVideoPath({ video_path: "sub-path", dub_video_path: "dub-path" }, "dub")).toBe("dub-path");
  });
  it("falls back to sub when an episode has no dub", () => {
    expect(episodeVideoPath({ video_path: "sub-path", dub_video_path: null }, "dub")).toBe("sub-path");
  });
  it("retains a completed sub for cleanup when a dub upload fails", async () => {
    vi.mocked(uploadMedia).mockResolvedValueOnce("sub-path").mockRejectedValueOnce(new Error("Dub failed"));
    const callbacks = options();
    await expect(uploadEpisodeVideos(sub, dub, "series", callbacks)).rejects.toThrow("Dub failed");
    expect(callbacks.onUploaded).toHaveBeenCalledWith("sub-path");
  });
});