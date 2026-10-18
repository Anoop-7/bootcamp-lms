import React, { useState, useRef, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VideoPlayer } from "../components/VideoPlayer";
import { api } from "../lib/api";
import {
  Folder as FolderIcon,
  PlayCircle,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  Video as VideoIcon,
  ExternalLink,
  Search,
  LayoutGrid,
  List,
  Mail,
  PanelLeft,
  Radio,
} from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  type: "RECORDING" | "OFFLINE_VIDEO" | "SLIDES" | "DOCUMENT";
  videoUrl?: string | null;
  resourceDoc?: string | null;
  durationSec: number;
  order: number;
}

interface FolderItem {
  id: string;
  title: string;
  order: number;
  contents: ContentItem[];
}

interface CohortDetail {
  id: string;
  title: string;
  description: string;
  isLiveActive?: boolean;
  folders: FolderItem[];
}

interface WatchProgress {
  id: string;
  contentId: string;
  watchedSeconds: number;
  isCompleted: boolean;
}

export const CoursePlayer: React.FC = () => {
  const { cohortId } = useParams<{ cohortId: string }>();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Navigation & explorer states
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState<ContentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Player cinema states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // 1. Fetch Cohort Curriculum
  const { data: cohort, isLoading: isCohortLoading } = useQuery<CohortDetail>({
    queryKey: ["cohort-curriculum", cohortId],
    queryFn: async () => {
      const res = await api.get(`/cohorts/${cohortId}`);
      return res.data.data;
    },
    enabled: !!cohortId,
  });

  // Expand all folders by default on mount
  useEffect(() => {
    if (cohort?.folders) {
      const initialMap: Record<string, boolean> = {};
      cohort.folders.forEach((f) => {
        initialMap[f.id] = true;
      });
      setExpandedFolders(initialMap);
    }
  }, [cohort]);

  // 2. Fetch Progress
  const { data: progressList } = useQuery<WatchProgress[]>({
    queryKey: ["cohort-progress", cohortId],
    queryFn: async () => {
      const res = await api.get(`/cohorts/${cohortId}/progress`);
      return res.data.data;
    },
    enabled: !!cohortId,
  });

  const progressMap = useMemo(() => {
    const map = new Map<string, WatchProgress>();
    progressList?.forEach((p) => map.set(p.contentId, p));
    return map;
  }, [progressList]);

  // Total Progress Stats
  const { totalVideos, completedVideos, progressPercent } = useMemo(() => {
    if (!cohort?.folders) return { totalVideos: 0, completedVideos: 0, progressPercent: 0 };
    let total = 0;
    let completed = 0;

    cohort.folders.forEach((f) => {
      f.contents?.forEach((c) => {
        if (c.type === "RECORDING" || c.type === "OFFLINE_VIDEO") {
          total += 1;
          if (progressMap.get(c.id)?.isCompleted) {
            completed += 1;
          }
        }
      });
    });

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { totalVideos: total, completedVideos: completed, progressPercent: percent };
  }, [cohort, progressMap]);

  // 3. Mutation: Update Progress
  const progressMutation = useMutation({
    mutationFn: async (payload: { contentId: string; watchedSeconds: number; isCompleted?: boolean }) => {
      const res = await api.post(`/contents/${payload.contentId}/progress`, {
        watchedSeconds: payload.watchedSeconds,
        isCompleted: payload.isCompleted,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-progress", cohortId] });
    },
  });

  const toggleFolderAccordion = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleSelectContent = (item: ContentItem) => {
    setActiveContent(item);

    // Sync selectedFolderId to whichever folder owns this content
    const parentFolder = cohort?.folders?.find((f) => f.contents?.some((c) => c.id === item.id));
    if (parentFolder) {
      setSelectedFolderId(parentFolder.id);
      setExpandedFolders((prev) => ({ ...prev, [parentFolder.id]: true }));
    }
  };

  const handleToggleComplete = () => {
    if (!activeContent) return;
    const currentStatus = progressMap.get(activeContent.id)?.isCompleted ?? false;
    const currentTime = videoRef.current ? Math.floor(videoRef.current.currentTime) : 0;

    progressMutation.mutate({
      contentId: activeContent.id,
      watchedSeconds: currentTime,
      isCompleted: !currentStatus,
    });
  };

  if (isCohortLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black text-neutral-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const currentFolder = cohort?.folders?.find((f) => f.id === selectedFolderId);

  // -------------------------------------------------------------
  // REUSABLE LIVE BANNER COMPONENT
  // -------------------------------------------------------------
  const renderLiveAlert = () => {
    if (!cohort?.isLiveActive) return null;

    return (
      <div className="bg-gradient-to-r from-red-950/95 via-red-900/60 to-neutral-950 border-b border-red-800/80 px-4 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <div>
            <p className="text-xs font-bold text-white flex items-center gap-2">
              <span>Live Interactive Class in Progress</span>
              <span className="bg-red-500/20 text-red-400 text-[9px] uppercase px-1.5 py-0.5 rounded border border-red-500/30">
                LIVE NOW
              </span>
            </p>
            <p className="text-[11px] text-neutral-300 hidden sm:block">
              Your instructor has initiated a live video broadcast for this cohort.
            </p>
          </div>
        </div>

        <Link
          to={`/cohorts/${cohort.id}/join-live`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all hover:scale-[1.02] shrink-0"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Join Live Stream</span>
        </Link>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW 1: DEDICATED SLIDES / RESOURCE CARD VIEW
  // -------------------------------------------------------------
  if (activeContent && (activeContent.type === "SLIDES" || activeContent.type === "DOCUMENT")) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#050507] text-neutral-100 flex flex-col justify-between">
        {renderLiveAlert()}

        <div className="max-w-2xl mx-auto w-full space-y-6 py-12 px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setActiveContent(null)}
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back to course</span>
          </button>

          <div className="bg-[#0e0e11] border border-neutral-800 rounded-2xl p-7 shadow-2xl space-y-6">
            <div className="flex items-center gap-2.5">
              <ExternalLink className="w-4 h-4 text-blue-400" />
              <h2 className="text-lg font-bold text-white">{activeContent.title}</h2>
            </div>

            {activeContent.resourceDoc ? (
              <a
                href={activeContent.resourceDoc}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-white text-black hover:bg-neutral-200 font-semibold text-sm rounded-xl transition-all shadow-md group"
              >
                <span>Open resource</span>
                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            ) : (
              <p className="text-xs text-neutral-500 italic">No external resource URL provided.</p>
            )}
          </div>
        </div>

        <div className="max-w-md mx-auto text-center space-y-3 pb-12 px-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Student Support
          </span>
          <h3 className="text-2xl font-bold text-white">Need help?</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Have a question or need assistance? Reach out to your cohort instructors anytime.
          </p>
          <a
            href="mailto:support@bootcamp.dev"
            className="inline-flex items-center gap-2 py-2 px-4 bg-[#0e0e11] border border-neutral-800 hover:bg-neutral-800 rounded-xl text-xs font-semibold text-white transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email support</span>
          </a>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: CINEMA VIDEO PLAYER
  // -------------------------------------------------------------
  if (activeContent && (activeContent.type === "RECORDING" || activeContent.type === "OFFLINE_VIDEO")) {
    const isCompleted = progressMap.get(activeContent.id)?.isCompleted ?? false;

    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-black text-neutral-200 overflow-hidden">
        {renderLiveAlert()}

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          {isSidebarOpen && (
            <aside className="w-72 lg:w-80 flex-shrink-0 border-r border-neutral-900 bg-[#09090b] flex flex-col h-full overflow-hidden transition-all duration-200 z-20">
              <div className="px-4 py-3.5 border-b border-neutral-900/80 flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
                  Course content
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {cohort?.folders?.map((folder) => {
                  const isOpen = !!expandedFolders[folder.id];

                  return (
                    <div key={folder.id} className="rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleFolderAccordion(folder.id)}
                        className="w-full px-2.5 py-2 flex items-center justify-between text-left rounded-md hover:bg-neutral-900 transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          {isOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          )}
                          <FolderIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-neutral-300 group-hover:text-white truncate">
                            {folder.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {folder.contents?.length || 0}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="mt-0.5 mb-1 pl-3 space-y-0.5 border-l border-neutral-900 ml-4">
                          {folder.contents?.map((item) => {
                            const isSelected = activeContent?.id === item.id;
                            const itemDone = progressMap.get(item.id)?.isCompleted;
                            const isVid = item.type === "RECORDING" || item.type === "OFFLINE_VIDEO";

                            return (
                              <button
                                key={item.id}
                                onClick={() => handleSelectContent(item)}
                                className={`w-full px-2.5 py-1.5 flex items-center justify-between text-left text-xs rounded transition-colors ${
                                  isSelected
                                    ? "bg-blue-600/15 text-blue-400 font-medium"
                                    : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  {isVid ? (
                                    <VideoIcon className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                                  ) : (
                                    <FileText className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                                  )}
                                  <span className="truncate">{item.title}</span>
                                </div>

                                {itemDone && (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Main Cinema Area */}
          <main className="flex-1 flex flex-col h-full overflow-y-auto bg-black">
            <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col justify-start">
              
              {/* Top Action Bar */}
              <div className="flex items-center gap-4 mb-2.5">
                <button
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0e0e11] hover:bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium text-neutral-300 transition-colors"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                  <span>{isSidebarOpen ? "Hide" : "Contents"}</span>
                </button>

                <button
                  onClick={() => setActiveContent(null)}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to course</span>
                </button>
              </div>

              {/* Video Container */}
              <div className="w-full bg-[#050507] rounded-xl overflow-hidden border border-neutral-900 shadow-2xl relative aspect-video max-h-[68vh] flex items-center justify-center">
                <VideoPlayer
                  key={activeContent.id}
                  contentId={activeContent.id}
                  onEnded={() => {
                    progressMutation.mutate({
                      contentId: activeContent.id,
                      watchedSeconds: activeContent.durationSec || 300,
                      isCompleted: true,
                    });
                  }}
                />
              </div>

              {/* Title & Under-Video Actions */}
              <div className="mt-4 space-y-3">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {activeContent.title}
                </h1>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleComplete}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isCompleted
                        ? "bg-emerald-950/70 border-emerald-800/80 text-emerald-300"
                        : "bg-[#0e0e11] border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900"
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isCompleted ? "text-emerald-400" : "text-neutral-500"}`} />
                    <span>{isCompleted ? "Completed" : "Mark Complete"}</span>
                  </button>
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: MODULE & FOLDER CARDS DIRECTORY
  // -------------------------------------------------------------
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#050507] text-white">
      {renderLiveAlert()}

      {/* Top Banner & Progress Header */}
      <div className="border-b border-neutral-900 bg-[#09090b]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
          <div className="flex items-center gap-3">
            {selectedFolderId ? (
              <button
                onClick={() => setSelectedFolderId(null)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
                title="Back to all modules"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <Link
                to="/dashboard"
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
                title="Back to Dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
            )}

            <div>
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
                Course Curriculum
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {selectedFolderId && currentFolder ? currentFolder.title : cohort?.title}
              </h1>
            </div>
          </div>

          <div className="space-y-2 max-w-xl">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>
                {completedVideos} of {totalVideos} videos completed
              </span>
              <span className="font-semibold text-blue-400">{progressPercent}%</span>
            </div>
            <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Explorer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lectures and lessons..."
              className="w-full pl-10 pr-4 py-2 bg-[#0e0e11] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#0e0e11] border border-neutral-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "list" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "grid" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Level 1: Root Folder Cards */}
        {!selectedFolderId && (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                : "flex flex-col gap-3"
            }
          >
            {cohort?.folders
              ?.filter((f) => f.title.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((folder) => {
                const videoCount = folder.contents?.filter(
                  (c) => c.type === "RECORDING" || c.type === "OFFLINE_VIDEO"
                ).length;
                const resourceCount = folder.contents?.filter(
                  (c) => c.type === "SLIDES" || c.type === "DOCUMENT"
                ).length;

                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className="group cursor-pointer bg-[#0e0e11] hover:bg-[#131317] border border-neutral-800/80 hover:border-neutral-700 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl flex flex-col justify-between"
                  >
                    <div className="h-44 bg-gradient-to-br from-blue-600 via-indigo-700 to-indigo-950 p-6 flex flex-col justify-between relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold tracking-widest text-blue-200 uppercase">
                          Bootcamp
                        </span>
                      </div>

                      <div className="text-center">
                        <span className="text-xs font-semibold text-blue-200/90 block mb-1">
                          Folder Module
                        </span>
                        <h3 className="text-xl font-extrabold text-white line-clamp-2 px-2">
                          {folder.title}
                        </h3>
                      </div>

                      <div className="flex items-center justify-end text-[11px] text-blue-200/80 font-mono">
                        {videoCount} videos • {resourceCount} resources
                      </div>
                    </div>

                    <div className="p-4 flex items-center justify-between text-xs text-neutral-400">
                      <span className="font-semibold text-neutral-200 group-hover:text-blue-400 transition-colors">
                        {folder.title}
                      </span>
                      <FolderIcon className="w-4 h-4 text-neutral-500 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Level 2: Inside Folder - Content Cards */}
        {selectedFolderId && currentFolder && (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                : "flex flex-col gap-3"
            }
          >
            {currentFolder.contents
              ?.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((item) => {
                const isItemCompleted = progressMap.get(item.id)?.isCompleted;
                const isVideo = item.type === "RECORDING" || item.type === "OFFLINE_VIDEO";

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectContent(item)}
                    className="group cursor-pointer bg-[#0e0e11] hover:bg-[#131317] border border-neutral-800/80 hover:border-neutral-700 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl flex flex-col justify-between"
                  >
                    <div className="h-44 bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-950 p-6 flex flex-col justify-between relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        {isItemCompleted ? (
                          <span className="w-7 h-7 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        ) : (
                          <div className="w-7 h-7 rounded-full border-2 border-blue-300/40" />
                        )}
                      </div>

                      <div className="text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-black/30 flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                          {isVideo ? (
                            <PlayCircle className="w-6 h-6" />
                          ) : (
                            <ExternalLink className="w-5 h-5" />
                          )}
                        </div>
                        <h4 className="text-lg font-bold text-white line-clamp-2 px-2">
                          {item.title}
                        </h4>
                      </div>

                      <div className="flex items-center justify-end text-[11px] text-blue-200/80 font-mono">
                        {isVideo ? "Lecture Video" : "Slides / Resource"}
                      </div>
                    </div>

                    <div className="p-4 flex items-center justify-between text-xs text-neutral-400">
                      <span className="font-semibold text-neutral-200 group-hover:text-blue-400 transition-colors truncate pr-2">
                        {item.title}
                      </span>
                      {isVideo ? (
                        <VideoIcon className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                      ) : (
                        <ExternalLink className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};