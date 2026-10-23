import React, { useRef, useState, useEffect, useCallback } from "react";
import Hls from "hls.js";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Check,
  Loader2,
} from "lucide-react";

interface VideoPlayerProps {
  contentId: string;
  onEnded?: () => void;
}

interface ApiErrorShape {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  contentId,
  onEnded,
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [qualities, setQualities] = useState<{ id: number; height: number; bitrate: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);

  const [watermarkPos, setWatermarkPos] = useState({ top: "20%", left: "30%" });

  const hasResumedRef = useRef(false);
  const initialResumeTimeRef = useRef<number>(0);

  const sessionTokenRef = useRef<string | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveProgress = useCallback(async (timeSec: number) => {
    if (!sessionTokenRef.current || !Number.isFinite(timeSec) || timeSec < 0) return;
    try {
      await api.post(`/contents/${contentId}/heartbeat`, {
        watchedSeconds: Math.floor(timeSec),
        sessionToken: sessionTokenRef.current,
      });
    } catch {
      // Background heartbeat failure handled silently
    }
  }, [contentId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 70 + 10) + "%";
      const left = Math.floor(Math.random() * 65 + 10) + "%";
      setWatermarkPos({ top, left });
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const currentVideo = videoRef.current;

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (seekSaveTimeoutRef.current) {
      clearTimeout(seekSaveTimeoutRef.current);
      seekSaveTimeoutRef.current = null;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (currentVideo) {
      if (sessionTokenRef.current && currentVideo.currentTime > 0) {
        saveProgress(currentVideo.currentTime);
      }
      currentVideo.pause();
      currentVideo.removeAttribute("src");
      currentVideo.load();
    }

    sessionTokenRef.current = null;
    hasResumedRef.current = false;
    initialResumeTimeRef.current = 0;

    async function initStream() {
      try {
        const res = await api.get(`/contents/${contentId}/access-url`);
        if (isCancelled) return;

        const { url, sessionToken, cookies } = res.data.data;
        sessionTokenRef.current = sessionToken;

        try {
          const progressRes = await api.get(`/contents/${contentId}/progress`);
          if (!isCancelled && progressRes.data?.data) {
            initialResumeTimeRef.current = progressRes.data.data.watchedSeconds || 0;
          }
        } catch {
          initialResumeTimeRef.current = 0;
        }

        if (isCancelled) return;

        if (!currentVideo) {
          setLoading(false);
          return;
        }

        let streamUrl = url;
        if (cookies && !url.includes("Expires=") && !url.includes("Key-Pair-Id=")) {
          const separator = url.includes("?") ? "&" : "?";
          streamUrl = `${url}${separator}Key-Pair-Id=${encodeURIComponent(
            cookies["CloudFront-Key-Pair-Id"]
          )}&Policy=${encodeURIComponent(
            cookies["CloudFront-Policy"]
          )}&Signature=${encodeURIComponent(
            cookies["CloudFront-Signature"]
          )}`;
        }

        const applyResumePosition = (vid: HTMLVideoElement) => {
          if (!hasResumedRef.current && initialResumeTimeRef.current > 0) {
            if (vid.duration && initialResumeTimeRef.current >= vid.duration - 5) {
              vid.currentTime = 0;
            } else {
              vid.currentTime = initialResumeTimeRef.current;
            }
            hasResumedRef.current = true;
          }
        };

        if (url.includes(".m3u8")) {
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              xhrSetup: (xhr, requestUrl) => {
                if (streamUrl.includes("?") && !requestUrl.includes("Key-Pair-Id=")) {
                  const query = streamUrl.split("?")[1];
                  const delimiter = requestUrl.includes("?") ? "&" : "?";
                  xhr.open("GET", `${requestUrl}${delimiter}${query}`, true);
                }
              },
            });

            if (isCancelled) {
              hls.destroy();
              return;
            }

            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(currentVideo);

            hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
              if (isCancelled) return;

              const availableQualities = data.levels.map((lvl, index) => ({
                id: index,
                height: lvl.height,
                bitrate: lvl.bitrate,
              }));
              setQualities(availableQualities);
              setLoading(false);

              applyResumePosition(currentVideo);

              currentVideo.play().then(() => {
                if (!isCancelled) setIsPlaying(true);
              }).catch(() => {});
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (isCancelled) return;
              if (data.fatal) {
                console.error("HLS fatal error:", data);
                setErrorMsg("Streaming failed to load chunks from CDN.");
                setLoading(false);
              }
            });
          } else if (currentVideo.canPlayType("application/vnd.apple.mpegurl")) {
            currentVideo.src = streamUrl;
            setLoading(false);
          }
        } else {
          currentVideo.src = streamUrl;
          setLoading(false);
        }

        heartbeatIntervalRef.current = setInterval(() => {
          if (!currentVideo || currentVideo.paused || isCancelled) return;
          saveProgress(currentVideo.currentTime);
        }, 20000);
      } catch (err: unknown) {
        if (!isCancelled) {
          const apiErr = err as ApiErrorShape;
          setErrorMsg(apiErr.response?.data?.message || apiErr.message || "Failed to load video stream.");
          setLoading(false);
        }
      }
    }

    if (contentId) {
      initStream();
    }

    return () => {
      isCancelled = true;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (seekSaveTimeoutRef.current) {
        clearTimeout(seekSaveTimeoutRef.current);
        seekSaveTimeoutRef.current = null;
      }
      if (currentVideo && sessionTokenRef.current && currentVideo.currentTime > 0) {
        saveProgress(currentVideo.currentTime);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [contentId, saveProgress]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  const togglePlay = () => {
    if (!videoRef.current || errorMsg || loading) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      saveProgress(videoRef.current.currentTime);
    }
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);

    if (seekSaveTimeoutRef.current) clearTimeout(seekSaveTimeoutRef.current);
    seekSaveTimeoutRef.current = setTimeout(() => {
      saveProgress(newTime);
    }, 600);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);

      if (seekSaveTimeoutRef.current) clearTimeout(seekSaveTimeoutRef.current);
      seekSaveTimeoutRef.current = setTimeout(() => {
        saveProgress(targetTime);
      }, 600);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const setSpeed = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSettings(false);
    }
  };

  const changeQuality = (levelIndex: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    setCurrentQuality(levelIndex);
    setShowSettings(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const watermarkText = user?.email || user?.id || "Student Account";

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-xl group select-none"
    >
      <video
        ref={videoRef}
        onClick={togglePlay}
        onTimeUpdate={() => {
          if (!videoRef.current) return;
          setCurrentTime(videoRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            if (!hasResumedRef.current && initialResumeTimeRef.current > 0) {
              if (initialResumeTimeRef.current < videoRef.current.duration - 5) {
                videoRef.current.currentTime = initialResumeTimeRef.current;
              }
              hasResumedRef.current = true;
            }
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (videoRef.current) {
            saveProgress(videoRef.current.duration);
          }
          onEnded?.();
        }}
        controlsList="nodownload"
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Floating Anti-Piracy Watermark Layer */}
      {!loading && !errorMsg && (
        <div
          style={{ top: watermarkPos.top, left: watermarkPos.left }}
          className="absolute pointer-events-none transition-all duration-1000 z-10 opacity-20 text-[11px] font-mono font-medium text-white select-none tracking-wider"
        >
          {watermarkText}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs z-20">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span>Securely loading video stream...</span>
        </div>
      )}

      {/* Error Overlay */}
      {errorMsg && (
        <div className="absolute inset-0 bg-black flex items-center justify-center text-red-500 font-semibold text-xs p-6 text-center z-20">
          {errorMsg}
        </div>
      )}

      {/* Controls Overlay */}
      {!loading && !errorMsg && (
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-300 flex flex-col justify-end z-20 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 sm:p-4 pointer-events-auto space-y-2">
            {/* Timeline Slider */}
            <div className="relative group/timeline flex items-center h-2 cursor-pointer">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-white/20 hover:h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-500 transition-all"
              />
            </div>

            {/* Playback Actions */}
            <div className="flex items-center justify-between text-white text-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="p-1 hover:text-blue-400 transition-colors"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-white" />
                  )}
                </button>

                <button
                  onClick={() => handleSkip(-10)}
                  className="p-1 hover:text-blue-400 transition-colors"
                  title="Rewind 10s"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSkip(10)}
                  className="p-1 hover:text-blue-400 transition-colors"
                  title="Forward 10s"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 group/vol">
                  <button onClick={toggleMute} className="p-1 hover:text-blue-400">
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-14 sm:w-16 h-1 bg-white/20 accent-blue-500 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="font-mono text-[11px] text-neutral-300 ml-1">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div className="flex items-center gap-3 relative">
                <button
                  onClick={() => setShowSettings((prev) => !prev)}
                  className="p-1 hover:text-blue-400 flex items-center gap-1 transition-colors"
                  title="Playback settings"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-[11px] font-mono">
                    {currentQuality === -1 ? "Auto" : `${qualities[currentQuality]?.height}p`}
                  </span>
                </button>

                {showSettings && (
                  <div className="absolute bottom-8 right-8 bg-[#121216] border border-neutral-800 rounded-xl p-2.5 w-44 shadow-2xl space-y-2 z-30 max-h-72 overflow-y-auto">
                    {qualities.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase text-neutral-400 px-2 py-0.5 tracking-wider border-b border-neutral-800">
                          Quality
                        </div>
                        <button
                          onClick={() => changeQuality(-1)}
                          className={`w-full px-2 py-1.5 flex items-center justify-between text-left text-xs rounded-md transition-colors ${
                            currentQuality === -1
                              ? "bg-blue-600/20 text-blue-400 font-semibold"
                              : "text-neutral-300 hover:bg-neutral-800"
                          }`}
                        >
                          <span>Auto (ABR)</span>
                          {currentQuality === -1 && <Check className="w-3.5 h-3.5" />}
                        </button>
                        {qualities.map((q) => (
                          <button
                            key={q.id}
                            onClick={() => changeQuality(q.id)}
                            className={`w-full px-2 py-1.5 flex items-center justify-between text-left text-xs rounded-md transition-colors ${
                              currentQuality === q.id
                                ? "bg-blue-600/20 text-blue-400 font-semibold"
                                : "text-neutral-300 hover:bg-neutral-800"
                            }`}
                          >
                            <span>{q.height}p</span>
                            {currentQuality === q.id && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase text-neutral-400 px-2 py-0.5 tracking-wider border-b border-neutral-800">
                        Playback Speed
                      </div>
                      {[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => setSpeed(rate)}
                          className={`w-full px-2 py-1.5 flex items-center justify-between text-left text-xs rounded-md transition-colors ${
                            playbackSpeed === rate
                              ? "bg-blue-600/20 text-blue-400 font-semibold"
                              : "text-neutral-300 hover:bg-neutral-800"
                          }`}
                        >
                          <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
                          {playbackSpeed === rate && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={toggleFullscreen}
                  className="p-1 hover:text-blue-400 transition-colors"
                  title="Fullscreen"
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4" />
                  ) : (
                    <Maximize className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};