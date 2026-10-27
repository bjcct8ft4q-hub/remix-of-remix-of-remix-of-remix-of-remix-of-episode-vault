import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw, FastForward, Download, Camera, Settings, PictureInPicture2, Maximize, Minimize } from "lucide-react";

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "00:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type Props = {
  src: string; poster?: string | undefined; autoPlay?: boolean; autoSkip?: boolean; fileName: string;
  onEnded?: () => void; onError?: () => void; onLoaded?: (v: HTMLVideoElement) => void;
};

export const VideoPlayer = forwardRef<HTMLVideoElement | null, Props>(function VideoPlayer({ src, poster, autoPlay, autoSkip, fileName, onEnded, onError, onLoaded }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => video.current as HTMLVideoElement);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [menu, setMenu] = useState(false);
  const [full, setFull] = useState(false);
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isHls = /\.m3u8(\?|$)/i.test(src);
  const isDirectVideo = /\.(mp4|webm|ogv)(\?|#|$)/i.test(src) || isHls;
  const isEmbed = !isDirectVideo;
  useEffect(() => {
    const el = video.current;
    if (!isHls || !el) return;
    if (el.canPlayType("application/vnd.apple.mpegurl")) { el.src = src; return; }
    let hls: { destroy: () => void } | undefined; let dead = false;
    void import("hls.js").then(({ default: Hls }) => {
      if (dead || !Hls.isSupported()) return;
      const h = new Hls(); hls = h; h.loadSource(src); h.attachMedia(el);
      h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) onError?.(); });
    });
    return () => { dead = true; hls?.destroy(); };
  }, [src, isHls, onError]);

  useEffect(() => {
    const f = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const v = () => video.current;
  const toggle = () => { const el = v(); if (!el) return; if (el.paused) void el.play().catch(() => {}); else el.pause(); };
  const seek = (d: number) => { const el = v(); if (el) el.currentTime = Math.min(Math.max(0, el.currentTime + d), el.duration || 0); };
  const wake = () => { setIdle(false); clearTimeout(timer.current); timer.current = setTimeout(() => setIdle(true), 2500); };
  const shot = () => {
    const el = v(); if (!el || !el.videoWidth) return;
    const c = document.createElement("canvas"); c.width = el.videoWidth; c.height = el.videoHeight;
    try {
      c.getContext("2d")?.drawImage(el, 0, 0);
      const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `${fileName}-${fmt(el.currentTime).replace(":", "-")}.png`; a.click();
    } catch { /* cross-origin frame */ }
  };
  const download = async () => {
    try {
      const blob = await (await fetch(src)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${fileName}.mp4`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { window.open(src, "_blank", "noopener"); }
  };
  const fs = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void wrap.current?.requestFullscreen(); };
  const pip = () => { const el = v(); if (!el) return; if (document.pictureInPictureElement) void document.exitPictureInPicture(); else void el.requestPictureInPicture?.().catch(() => {}); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowLeft") seek(-10);
      else if (e.key === "ArrowRight") seek(10);
      else if (e.key === "f") fs();
      else if (e.key === "m") { const el = v(); if (el) el.muted = !el.muted; }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  if (isEmbed) {
    return <div ref={wrap} className="relative h-full w-full bg-overlay">
      <iframe
        key={src}
        src={src}
        title={fileName ? `Video player — ${fileName}` : "Video player"}
        className="h-full w-full border-0"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
      />
    </div>;
  }

  const pct = dur ? (time / dur) * 100 : 0;
  const btn = "flex h-8 w-8 items-center justify-center rounded-full text-foreground/90 transition hover:bg-foreground/10 hover:text-primary";
  const showUi = !playing || !idle || menu;

  return (
    <div ref={wrap} onMouseMove={wake} onMouseLeave={() => setIdle(true)} className={`group relative h-full w-full bg-overlay ${showUi ? "" : "cursor-none"}`}>
      <video ref={video} src={isHls ? undefined : src} poster={poster} autoPlay={autoPlay} playsInline preload="metadata" className="h-full w-full" onClick={toggle} onDoubleClick={fs}
        onPlay={() => { setPlaying(true); wake(); }} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onProgress={(e) => { const b = e.currentTarget.buffered; if (b.length) setBuffered(b.end(b.length - 1)); }}
        onLoadedMetadata={(e) => { setDur(e.currentTarget.duration); e.currentTarget.playbackRate = speed; onLoaded?.(e.currentTarget); if (autoSkip && e.currentTarget.currentTime < 1) e.currentTarget.currentTime = Math.min(85, e.currentTarget.duration); }}
        onVolumeChange={(e) => { setMuted(e.currentTarget.muted); setVolume(e.currentTarget.volume); }}
        onEnded={onEnded} onError={onError} />
      {!playing && <button type="button" aria-label="Play" onClick={toggle} className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-overlay/70 text-foreground backdrop-blur transition hover:scale-105 hover:text-primary"><Play className="ml-1 h-7 w-7 fill-current" /></button>}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-overlay/90 to-transparent px-3 pb-2 pt-10 transition-opacity ${showUi ? "opacity-100" : "opacity-0"}`}>
        <div className="relative mb-2 h-1.5 cursor-pointer rounded-full bg-foreground/25" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const el = v(); if (el && dur) el.currentTime = ((e.clientX - r.left) / r.width) * dur; }}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-foreground/35" style={{ width: `${dur ? (buffered / dur) * 100 : 0}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
          <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow" style={{ left: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full bg-overlay/60 px-2 py-1">
            <button type="button" className={btn} aria-label={playing ? "Pause" : "Play"} onClick={toggle}>{playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}</button>
            <button type="button" className={btn} aria-label={muted ? "Unmute" : "Mute"} onClick={() => { const el = v(); if (el) el.muted = !el.muted; }}>{muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
            <input type="range" aria-label="Volume" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => { const el = v(); if (el) { el.volume = Number(e.target.value); el.muted = el.volume === 0; } }} className="hidden w-16 accent-primary sm:block" />
            <span className="px-1 text-xs tabular-nums text-foreground">{fmt(time)} / {fmt(dur)}</span>
          </div>
          <div className="relative flex items-center gap-0.5 rounded-full bg-overlay/60 px-2 py-1">
            <button type="button" className={btn} aria-label="Back 10 seconds" title="-10s" onClick={() => seek(-10)}><RotateCcw className="h-4 w-4" /></button>
            <button type="button" className={btn} aria-label="Forward 10 seconds" title="+10s" onClick={() => seek(10)}><RotateCw className="h-4 w-4" /></button>
            <button type="button" className={btn} aria-label="Skip 85 seconds" title="+85s (skip intro)" onClick={() => seek(85)}><FastForward className="h-4 w-4" /></button>
            <button type="button" className={btn} aria-label="Download" title="Download" onClick={download}><Download className="h-4 w-4" /></button>
            <button type="button" className={btn} aria-label="Screenshot" title="Screenshot" onClick={shot}><Camera className="h-4 w-4" /></button>
            <button type="button" className={btn} aria-label="Settings" title="Playback speed" aria-expanded={menu} onClick={() => setMenu(!menu)}><Settings className={`h-4 w-4 transition ${menu ? "rotate-45 text-primary" : ""}`} /></button>
            <button type="button" className={`${btn} hidden sm:flex`} aria-label="Picture in picture" title="Picture in picture" onClick={pip}><PictureInPicture2 className="h-4 w-4" /></button>
            <button type="button" className={btn} aria-label={full ? "Exit fullscreen" : "Fullscreen"} onClick={fs}>{full ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</button>
            {menu && <div className="absolute bottom-11 right-10 w-36 rounded-md border border-border bg-popover p-1 text-xs shadow-lg">
              <p className="px-2 py-1 font-bold uppercase text-muted-foreground">Speed</p>
              {SPEEDS.map((s) => <button key={s} type="button" onClick={() => { setSpeed(s); const el = v(); if (el) el.playbackRate = s; setMenu(false); }} className={`block w-full rounded-sm px-2 py-1.5 text-left hover:bg-muted ${speed === s ? "text-primary" : ""}`}>{s === 1 ? "Normal" : `${s}x`}</button>)}
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
});
