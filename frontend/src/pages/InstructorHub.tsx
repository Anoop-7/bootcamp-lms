import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { uploadLargeVideoFile } from "../utils/videoUpload";
import {
  Radio,
  Users,
  FolderPlus,
  FilePlus,
  Play,
  Square,
  Loader2,
  UploadCloud,
  FileText,
  Video as VideoIcon,
  Plus,
  Settings,
  BarChart3,
  Layers,
  IndianRupee,
  Sparkles,
  X,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react";

interface AttendanceRecord {
  id: string;
  userId: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface VideoAssetInfo {
  id: string;
  status: "UPLOADING" | "QUEUED" | "ENCODING" | "READY" | "FAILED";
  posterKey?: string | null;
  durationSec?: number | null;
}

interface ContentItem {
  id: string;
  title: string;
  type: string;
  order: number;
  videoAsset?: VideoAssetInfo | null;
}

interface FolderItem {
  id: string;
  title: string;
  order: number;
  contents: ContentItem[];
}

interface CohortDetailResponse {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail?: string | null;
  price: number;
  originalPrice?: number | null;
  validity?: string | null;
  deliveryType: "LIVE" | "RECORDED" | "HYBRID";
  status: "UPCOMING_LIVE" | "ONGOING_LIVE" | "COMPLETED_LIVE" | "SELF_PACED";
  startDate?: string | null;
  endDate?: string | null;
  isLiveActive: boolean;
  currentLiveUrl: string | null;
  folders: FolderItem[];
}

interface ApiErrorShape {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as ApiErrorShape;
  return err.response?.data?.message || err.message || fallback;
}

export const InstructorHub: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedCohortIdState, setSelectedCohortIdState] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"live" | "curriculum" | "pricing" | "analytics">("live");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newThumbnail, setNewThumbnail] = useState("");
  const [newPrice, setNewPrice] = useState<number | "">(2999);
  const [newOriginalPrice, setNewOriginalPrice] = useState<number | "">(4999);
  const [newValidity, setNewValidity] = useState("3 years from date of purchase");
  const [newDeliveryType, setNewDeliveryType] = useState<"LIVE" | "RECORDED" | "HYBRID">("LIVE");

  const isCreateFormValid =
    newTitle.trim().length > 0 &&
    newDescription.trim().length > 0 &&
    newStartDate.trim().length > 0 &&
    newPrice !== "" &&
    Number(newPrice) >= 0;

  const [zoomUrl, setZoomUrl] = useState("");

  const [folderTitle, setFolderTitle] = useState("");
  const [selectedFolderIdState, setSelectedFolderIdState] = useState<string>("");
  const [contentType, setContentType] = useState<string>("");
  const [contentTitle, setContentTitle] = useState("");
  const [resourceDocUrl, setResourceDocUrl] = useState("");

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderTitle, setEditingFolderTitle] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [pendingCohortUpdates, setPendingCohortUpdates] = useState<Partial<CohortDetailResponse> | null>(null);

  const { data: cohorts, isLoading: isCohortsLoading } = useQuery<CohortDetailResponse[]>({
    queryKey: ["instructor-cohorts", user?.id],
    queryFn: async () => {
      const res = await api.get("/cohorts/instructor/me");
      return res.data.data;
    },
    enabled: !!user?.id,
  });

  const selectedCohortId =
    selectedCohortIdState || (cohorts && cohorts.length > 0 ? cohorts[0].id : "");

  const { data: currentCohort } = useQuery<CohortDetailResponse>({
    queryKey: ["cohort-curriculum", selectedCohortId],
    queryFn: async () => {
      const res = await api.get(`/cohorts/${selectedCohortId}`);
      return res.data.data;
    },
    enabled: !!selectedCohortId,
    refetchInterval: (query) => {
      const cohort = query.state.data;
      const hasEncodingVideos = cohort?.folders?.some((f) =>
        f.contents?.some(
          (c) =>
            c.videoAsset?.status === "ENCODING" ||
            c.videoAsset?.status === "QUEUED" ||
            c.videoAsset?.status === "UPLOADING"
        )
      );
      return hasEncodingVideos ? 5000 : false;
    },
  });

  const selectedFolderId =
    currentCohort?.folders?.some((f) => f.id === selectedFolderIdState)
      ? selectedFolderIdState
      : "";

  const { data: attendanceList, isLoading: isAttendanceLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["cohort-attendance", selectedCohortId],
    queryFn: async () => {
      const res = await api.get(`/cohorts/${selectedCohortId}/attendance`);
      return res.data.data;
    },
    enabled: !!selectedCohortId && activeTab === "live",
    refetchInterval: currentCohort?.isLiveActive ? 5000 : false,
  });

  const createCohortMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/cohorts", {
        title: newTitle.trim(),
        description: newDescription.trim(),
        thumbnail: newThumbnail.trim() || undefined,
        startDate: newStartDate ? new Date(newStartDate).toISOString() : undefined,
        price: Number(newPrice),
        originalPrice: newOriginalPrice !== "" ? Number(newOriginalPrice) : undefined,
        validity: newValidity,
        deliveryType: newDeliveryType,
      });
      return res.data.data;
    },
    onSuccess: (newCohort: CohortDetailResponse) => {
      queryClient.invalidateQueries({ queryKey: ["instructor-cohorts"] });
      setIsCreateModalOpen(false);
      setSelectedCohortIdState(newCohort.id);
      setNewTitle("");
      setNewDescription("");
      setNewThumbnail("");
      setNewStartDate("");
      setNewPrice(2999);
      setNewOriginalPrice(4999);
      alert("Cohort created as Draft! You can now configure curriculum and pricing before publishing.");
    },
    onError: (err: unknown) => {
      alert(getErrorMessage(err, "Failed to create cohort"));
    },
  });

  const updateCohortMutation = useMutation({
    mutationFn: async (payload: Partial<CohortDetailResponse>) => {
      const res = await api.put(`/cohorts/${selectedCohortId}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-cohorts"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", selectedCohortId] });
      setIsEditingDetails(false);
      setIsConfirmSaveOpen(false);
      setPendingCohortUpdates(null);
      alert("Cohort details updated successfully!");
    },
    onError: (err: unknown) => {
      alert("Failed to update settings: " + getErrorMessage(err, "Update failed"));
    },
  });

  const deleteCohortMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/cohorts/${selectedCohortId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-cohorts", user?.id] });
      setIsDeleteModalOpen(false);
      setDeleteConfirmationInput("");
      setSelectedCohortIdState("");
      alert("Cohort has been permanently deleted.");
    },
    onError: (err: unknown) => {
      alert(getErrorMessage(err, "Failed to delete cohort"));
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async (newStatus: "UPCOMING_LIVE" | "ONGOING_LIVE") => {
      const res = await api.put(`/cohorts/${selectedCohortId}`, {
        status: newStatus,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-cohorts"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", selectedCohortId] });
      queryClient.invalidateQueries({ queryKey: ["public-cohorts"] });
      alert("Cohort visibility status updated successfully!");
    },
    onError: (err: unknown) => {
      alert("Failed to update status: " + getErrorMessage(err, "Status update failed"));
    },
  });

  const isPublishReady =
    Boolean(currentCohort?.folders && currentCohort.folders.length > 0) &&
    Boolean(currentCohort?.startDate) &&
    Boolean(currentCohort?.description?.trim());

  const startLiveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/cohorts/${selectedCohortId}/start-live`, { zoomUrl });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-cohorts"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", selectedCohortId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-attendance", selectedCohortId] });
      setZoomUrl("");
    },
  });

  const endLiveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/cohorts/${selectedCohortId}/end-live`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-cohorts"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", selectedCohortId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-attendance", selectedCohortId] });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const nextOrder = (currentCohort?.folders?.length || 0) + 1;
      const res = await api.post(`/cohorts/${selectedCohortId}/folders`, {
        title: folderTitle.trim(),
        order: nextOrder,
      });
      return res.data.data;
    },
    onSuccess: () => {
      setFolderTitle("");
      queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", selectedCohortId] });
      alert("Module folder created successfully!");
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ folderId, title }: { folderId: string; title: string }) => {
      const res = await api.put(`/folders/${folderId}`, { title });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", selectedCohortId] });
      setEditingFolderId(null);
      setEditingFolderTitle("");
    },
    onError: (err: unknown) => alert(getErrorMessage(err, "Failed to rename folder")),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      await api.delete(`/folders/${folderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", selectedCohortId] });
      alert("Folder and its contents removed.");
    },
    onError: (err: unknown) => alert(getErrorMessage(err, "Failed to delete folder")),
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (contentId: string) => {
      await api.delete(`/contents/${contentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", selectedCohortId] });
      alert("Asset deleted.");
    },
    onError: (err: unknown) => alert(getErrorMessage(err, "Failed to delete asset")),
  });

  const isVideoType = contentType === "RECORDING" || contentType === "OFFLINE_VIDEO";

  const handleAttachContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolderId || !contentType || !contentTitle.trim()) return;

    let finalVideoAssetId: string | null = null;
    let finalDocUrl: string | null = null;

    if (isVideoType) {
      if (!selectedFile) {
        alert("Please pick an MP4 video file.");
        return;
      }

      try {
        setIsUploading(true);
        setUploadProgress(0);

        const { videoAssetId } = await uploadLargeVideoFile(selectedFile, (pct) => {
          setUploadProgress(pct);
        });

        finalVideoAssetId = videoAssetId;
      } catch (err: unknown) {
        alert("Multipart upload failed: " + getErrorMessage(err, "Upload failed"));
        setIsUploading(false);
        setUploadProgress(null);
        return;
      } finally {
        setIsUploading(false);
      }
    } else {
      if (!resourceDocUrl.trim()) {
        alert("Please enter the resource / Notion URL.");
        return;
      }
      finalDocUrl = resourceDocUrl.trim();
    }

    try {
      const targetFolder = currentCohort?.folders?.find((f) => f.id === selectedFolderId);
      const nextOrder = (targetFolder?.contents?.length || 0) + 1;

      await api.post(`/folders/${selectedFolderId}/contents`, {
        title: contentTitle.trim(),
        type: contentType,
        videoAssetId: finalVideoAssetId,
        resourceDoc: finalDocUrl,
        durationSec: 3600,
        order: nextOrder,
      });

      setContentTitle("");
      setResourceDocUrl("");
      setSelectedFile(null);
      setUploadProgress(null);
      queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", selectedCohortId] });
      alert("Lecture asset uploaded and queued for transcoding!");
    } catch (err: unknown) {
      alert("Failed to attach asset: " + getErrorMessage(err, "Attachment failed"));
    }
  };

  if (isCohortsLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black text-neutral-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#09090b] text-neutral-100">
      <div className="border-b border-neutral-800 bg-[#0f0f12]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/60 uppercase tracking-wider">
                  Instructor Workspace
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                Instructor Hub
              </h1>
              <p className="text-neutral-400 text-xs mt-0.5">
                Launch live sessions, manage cohorts, upload curriculum modules, and set pricing.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {cohorts && cohorts.length > 0 && (
                <select
                  value={selectedCohortId}
                  onChange={(e) => setSelectedCohortIdState(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 text-white text-xs font-medium rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 max-w-xs truncate"
                >
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Create Cohort</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6 border-t border-neutral-800/80 pt-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab("live")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "live"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              <span>Live Broadcast</span>
            </button>

            <button
              onClick={() => setActiveTab("curriculum")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "curriculum"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Curriculum & Assets</span>
            </button>

            <button
              onClick={() => setActiveTab("pricing")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "pricing"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>Pricing & Details</span>
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "analytics"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-neutral-500" />
              <span className="flex items-center gap-1.5">
                Analytics
                <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded-full uppercase">
                  Soon
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {currentCohort && (
        <div className="bg-[#121216] border-b border-neutral-800/80 px-4 sm:px-8 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">Current Status:</span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  currentCohort.status === "UPCOMING_LIVE"
                    ? "bg-amber-950/60 text-amber-400 border-amber-800/60"
                    : currentCohort.status === "ONGOING_LIVE"
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                    : "bg-neutral-900 text-neutral-300 border-neutral-700"
                }`}
              >
                {currentCohort.status.replace("_", " ")}
              </span>

              {(!currentCohort.folders || currentCohort.folders.length === 0) && (
                <span className="text-[11px] text-amber-400/90 hidden md:inline">
                  (Add at least 1 curriculum module before going live)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentCohort.status === "UPCOMING_LIVE" ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!isPublishReady) {
                      alert(
                        "Cannot publish cohort yet: Ensure you have added at least one curriculum folder and set a start date."
                      );
                      return;
                    }
                    if (
                      window.confirm(
                        `Are you ready to publish "${currentCohort.title}" to the public catalog? Students will be able to discover and enroll.`
                      )
                    ) {
                      togglePublishMutation.mutate("ONGOING_LIVE");
                    }
                  }}
                  disabled={togglePublishMutation.isPending}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  {togglePublishMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Publish to Public Catalog</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Move "${currentCohort.title}" back to Upcoming / Draft?`
                      )
                    ) {
                      togglePublishMutation.mutate("UPCOMING_LIVE");
                    }
                  }}
                  disabled={togglePublishMutation.isPending}
                  className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-xl transition-colors border border-neutral-700 flex items-center gap-1.5"
                >
                  {togglePublishMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Revert to Draft / Pre-launch</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "live" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-[#121216] border border-neutral-800/80 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-indigo-400" />
                  Live Broadcast Control
                </h2>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border ${
                    currentCohort?.isLiveActive
                      ? "bg-red-950 text-red-400 border-red-800 animate-pulse"
                      : "bg-neutral-950 text-neutral-400 border-neutral-800"
                  }`}
                >
                  {currentCohort?.isLiveActive ? "BROADCASTING LIVE" : "STANDBY"}
                </span>
              </div>

              {currentCohort?.isLiveActive ? (
                <div className="space-y-4">
                  <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl">
                    <p className="text-xs text-red-300 font-medium">Session in progress:</p>
                    <p className="text-xs text-neutral-300 truncate font-mono mt-1">
                      {currentCohort.currentLiveUrl}
                    </p>
                  </div>
                  <button
                    onClick={() => endLiveMutation.mutate()}
                    disabled={endLiveMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
                  >
                    {endLiveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                    End Live Stream
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                      Zoom / Meeting Room Link
                    </label>
                    <input
                      type="url"
                      value={zoomUrl}
                      onChange={(e) => setZoomUrl(e.target.value)}
                      placeholder="https://zoom.us/j/1234567890"
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    onClick={() => startLiveMutation.mutate()}
                    disabled={!zoomUrl || startLiveMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
                  >
                    {startLiveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Start Broadcast
                  </button>
                </div>
              )}
            </div>

            <div className="bg-[#121216] border border-neutral-800/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Live Attendance Logs
                  </h2>
                  <span className="text-xs text-neutral-400 font-medium">
                    {attendanceList?.length || 0} Attended
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-neutral-800/80 border border-neutral-800/80 rounded-xl">
                  {isAttendanceLoading ? (
                    <div className="p-4 text-center text-xs text-neutral-500">Loading attendance...</div>
                  ) : attendanceList && attendanceList.length > 0 ? (
                    attendanceList.map((log) => (
                      <div key={log.id} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-neutral-200">{log.user?.name || "Student"}</p>
                          <p className="text-neutral-500">{log.user?.email}</p>
                        </div>
                        <span className="text-neutral-400 font-mono text-[11px]">
                          {new Date(log.joinedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-neutral-500">
                      No attendance records logged for this session yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "curriculum" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 bg-[#121216] border border-neutral-800/80 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Syllabus Modules & Content
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {currentCohort?.folders?.length || 0} Modules configured
                  </p>
                </div>
              </div>

              {currentCohort?.folders && currentCohort.folders.length > 0 ? (
                <div className="space-y-3">
                  {currentCohort.folders.map((folder, index) => {
                    const isCollapsed = collapsedFolders[folder.id];
                    const isEditing = editingFolderId === folder.id;

                    return (
                      <div
                        key={folder.id}
                        className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl overflow-hidden transition-colors"
                      >
                        <div className="p-3.5 flex items-center justify-between gap-3 bg-neutral-900/40">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleFolderCollapse(folder.id)}
                              className="text-neutral-400 hover:text-white"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>

                            <span className="text-[11px] font-mono font-bold text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-900/60 shrink-0">
                              M{index + 1}
                            </span>

                            {isEditing ? (
                              <div className="flex items-center gap-1.5 flex-1">
                                <input
                                  type="text"
                                  value={editingFolderTitle}
                                  onChange={(e) => setEditingFolderTitle(e.target.value)}
                                  className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    renameFolderMutation.mutate({
                                      folderId: folder.id,
                                      title: editingFolderTitle,
                                    })
                                  }
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingFolderId(null)}
                                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-white truncate">
                                {folder.title}
                              </span>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFolderIdState(folder.id);
                                }}
                                title="Attach asset to this folder"
                                className="px-2 py-1 text-[11px] font-medium text-neutral-400 hover:text-indigo-400 hover:bg-neutral-800 rounded-md transition-colors"
                              >
                                + Add Asset
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFolderId(folder.id);
                                  setEditingFolderTitle(folder.title);
                                }}
                                title="Rename folder"
                                className="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Delete folder "${folder.title}" and all its contents?`
                                    )
                                  ) {
                                    deleteFolderMutation.mutate(folder.id);
                                  }
                                }}
                                title="Delete folder"
                                className="p-1.5 text-neutral-400 hover:text-red-400 rounded-md hover:bg-neutral-800 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {!isCollapsed && (
                          <div className="p-3 divide-y divide-neutral-900 border-t border-neutral-800/40">
                            {folder.contents && folder.contents.length > 0 ? (
                              folder.contents.map((content) => {
                                const isVideo = content.type === "RECORDING" || content.type === "OFFLINE_VIDEO";
                                const status = content.videoAsset?.status;

                                return (
                                  <div
                                    key={content.id}
                                    className="py-2.5 px-2 flex items-center justify-between gap-3 text-xs hover:bg-neutral-900/40 rounded-lg group transition-colors"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {isVideo ? (
                                        <VideoIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                      ) : (
                                        <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      )}

                                      <span className="text-neutral-200 truncate font-medium">
                                        {content.title}
                                      </span>

                                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400 border border-neutral-800 shrink-0">
                                        {content.type}
                                      </span>

                                      {isVideo && status && (
                                        <>
                                          {status === "UPLOADING" && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                                              Uploading...
                                            </span>
                                          )}
                                          {(status === "QUEUED" || status === "ENCODING") && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 animate-pulse flex items-center gap-1">
                                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                              Transcoding...
                                            </span>
                                          )}
                                          {status === "READY" && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                              Ready
                                            </span>
                                          )}
                                          {status === "FAILED" && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                                              Failed
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`Delete "${content.title}"?`)) {
                                          deleteContentMutation.mutate(content.id);
                                        }
                                      }}
                                      title="Delete content"
                                      className="p-1 text-neutral-500 hover:text-red-400 opacity-80 group-hover:opacity-100 rounded transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="py-4 text-center text-xs text-neutral-500 italic">
                                No lectures or documents in this module yet.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/40">
                  <FolderPlus className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400 font-medium">No modules created yet.</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Use the form on the right to start building your course syllabus.
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#121216] border border-neutral-800/80 rounded-2xl p-5 shadow-xl space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-indigo-400" />
                  Create New Module
                </h3>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase mb-1">
                    Folder Title
                  </label>
                  <input
                    type="text"
                    value={folderTitle}
                    onChange={(e) => setFolderTitle(e.target.value)}
                    placeholder="e.g. Week 2: Distributed Caching with Redis"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => createFolderMutation.mutate()}
                  disabled={!folderTitle.trim() || createFolderMutation.isPending}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {createFolderMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Module</span>
                </button>
              </div>

              <form
                onSubmit={handleAttachContent}
                className="bg-[#121216] border border-neutral-800/80 rounded-2xl p-5 shadow-xl space-y-3"
              >
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FilePlus className="w-4 h-4 text-indigo-400" />
                  Attach Lecture / Asset
                </h3>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase mb-1">
                    Target Folder
                  </label>
                  {currentCohort?.folders && currentCohort.folders.length > 0 ? (
                    <select
                      value={selectedFolderId}
                      onChange={(e) => setSelectedFolderIdState(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="" disabled>
                        -- Select Module --
                      </option>
                      {currentCohort.folders.map((f, i) => (
                        <option key={f.id} value={f.id}>
                          M{i + 1}: {f.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[11px] text-amber-400 bg-amber-950/30 p-2.5 rounded-xl border border-amber-800/60">
                      Create at least one module folder before attaching assets.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase mb-1">
                    Asset Type
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="" disabled>
                      -- Select Type --
                    </option>
                    <option value="RECORDING">Class Recording (Video)</option>
                    <option value="OFFLINE_VIDEO">Offline Tutorial (Video)</option>
                    <option value="SLIDES">Slides / Notes (Notion or Slide Link)</option>
                    <option value="DOCUMENT">Resource Document (PDF or External)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={contentTitle}
                    onChange={(e) => setContentTitle(e.target.value)}
                    placeholder="e.g. Lecture 1: Redis Master-Replica"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                {isVideoType ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase mb-1 flex items-center gap-1.5">
                      <VideoIcon className="w-3.5 h-3.5 text-indigo-400" />
                      Select MP4 Video (S3 Multipart Upload)
                    </label>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-neutral-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 cursor-pointer"
                    />

                    {uploadProgress !== null && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[11px] text-neutral-400">
                          <span>Uploading chunks to S3...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-neutral-800 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-1 transition-all duration-150"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : contentType === "SLIDES" || contentType === "DOCUMENT" ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase mb-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      Resource / Notion URL
                    </label>
                    <input
                      type="url"
                      value={resourceDocUrl}
                      onChange={(e) => setResourceDocUrl(e.target.value)}
                      placeholder="https://notion.site/..."
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    !selectedFolderId ||
                    !contentType ||
                    !contentTitle.trim() ||
                    isUploading ||
                    (isVideoType && !selectedFile) ||
                    (!isVideoType && !resourceDocUrl.trim())
                  }
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading ({uploadProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Publish Asset</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === "pricing" && currentCohort && (
          <div className="max-w-4xl bg-[#121216] border border-neutral-800/80 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-indigo-400" />
                  Cohort Details & Commerce
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Live pricing, public landing page copy, and lifecycle state.
                </p>
              </div>

              {!isEditingDetails && (
                <button
                  onClick={() => setIsEditingDetails(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-200 hover:text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
                >
                  <Settings className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Edit Details</span>
                </button>
              )}
            </div>

            {!isEditingDetails ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                      Selling Price
                    </span>
                    <div className="text-lg font-bold text-white font-mono flex items-baseline gap-1">
                      <span>₹{currentCohort.price.toLocaleString("en-IN")}</span>
                      {currentCohort.originalPrice && currentCohort.originalPrice > currentCohort.price && (
                        <span className="text-[11px] text-emerald-400 font-sans font-medium">
                          ({Math.round(((currentCohort.originalPrice - currentCohort.price) / currentCohort.originalPrice) * 100)}% off)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                      Original / MRP
                    </span>
                    <div className="text-lg font-bold text-neutral-400 font-mono line-through">
                      ₹{currentCohort.originalPrice ? currentCohort.originalPrice.toLocaleString("en-IN") : currentCohort.price.toLocaleString("en-IN")}
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                      Delivery Mode
                    </span>
                    <div className="text-xs font-semibold text-neutral-200 mt-1">
                      {currentCohort.deliveryType === "LIVE"
                        ? "Interactive Live"
                        : currentCohort.deliveryType === "RECORDED"
                        ? "Self-Paced Recorded"
                        : "Hybrid"}
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                      Lifecycle Status
                    </span>
                    <div>
                      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60 uppercase">
                        {currentCohort.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-neutral-950/40 border border-neutral-800/60 rounded-xl space-y-1">
                    <span className="text-neutral-500 font-medium">Access Validity:</span>
                    <p className="text-neutral-200 font-medium">{currentCohort.validity || "3 years from date of purchase"}</p>
                  </div>

                  <div className="p-4 bg-neutral-950/40 border border-neutral-800/60 rounded-xl space-y-1">
                    <span className="text-neutral-500 font-medium">Start Date:</span>
                    <p className="text-neutral-200 font-medium">
                      {currentCohort.startDate
                        ? new Date(currentCohort.startDate).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "Self-Paced / Immediate Access"}
                    </p>
                  </div>
                </div>

                <div className="p-5 bg-neutral-950/40 border border-neutral-800/60 rounded-xl space-y-2">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Course Description
                  </span>
                  <p className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">
                    {currentCohort.description}
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);

                  const rawStartDate = formData.get("startDate") as string;
                  const deliveryTypeVal = formData.get("deliveryType");
                  const statusVal = formData.get("status");

                  const payload: Partial<CohortDetailResponse> = {
                    price: Number(formData.get("price")),
                    originalPrice: Number(formData.get("originalPrice")),
                    validity: formData.get("validity") as string,
                    deliveryType: (deliveryTypeVal || "LIVE") as "LIVE" | "RECORDED" | "HYBRID",
                    status: (statusVal || "UPCOMING_LIVE") as
                      | "UPCOMING_LIVE"
                      | "ONGOING_LIVE"
                      | "COMPLETED_LIVE"
                      | "SELF_PACED",
                    startDate: rawStartDate ? new Date(rawStartDate).toISOString() : null,
                    description: formData.get("description") as string,
                  };

                  setPendingCohortUpdates(payload);
                  setIsConfirmSaveOpen(true);
                }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                      Selling Price (₹)
                    </label>
                    <input
                      type="number"
                      name="price"
                      min="0"
                      defaultValue={currentCohort.price}
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                      Strike-through Price (₹)
                    </label>
                    <input
                      type="number"
                      name="originalPrice"
                      min="0"
                      defaultValue={currentCohort.originalPrice || 4999}
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                      Access Validity
                    </label>
                    <input
                      type="text"
                      name="validity"
                      defaultValue={currentCohort.validity || "3 years from date of purchase"}
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                      Delivery Type
                    </label>
                    <select
                      name="deliveryType"
                      defaultValue={currentCohort.deliveryType || "LIVE"}
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="LIVE">Live Interactive Cohort</option>
                      <option value="RECORDED">Self-Paced / Recorded</option>
                      <option value="HYBRID">Hybrid (Live + Recorded)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      defaultValue={
                        currentCohort.startDate
                          ? new Date(currentCohort.startDate).toISOString().split("T")[0]
                          : ""
                      }
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                      Cohort Lifecycle Status
                    </label>
                    <select
                      name="status"
                      defaultValue={currentCohort.status || "UPCOMING_LIVE"}
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="UPCOMING_LIVE">Upcoming Live</option>
                      <option value="ONGOING_LIVE">Ongoing Live</option>
                      <option value="COMPLETED_LIVE">Completed Live</option>
                      <option value="SELF_PACED">Self-Paced</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                    Course Description / About This Course
                  </label>
                  <textarea
                    name="description"
                    rows={5}
                    defaultValue={currentCohort.description}
                    className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                    required
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetails(false)}
                    className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-red-950/40">
              <div className="p-5 rounded-2xl bg-red-950/10 border border-red-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-red-400">Danger Zone</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Permanently delete this cohort and all its associated modules and curriculum assets.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmationInput("");
                    setIsDeleteModalOpen(true);
                  }}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600 border border-red-800/80 hover:border-red-600 text-red-300 hover:text-white text-xs font-semibold rounded-xl transition-all whitespace-nowrap self-start sm:self-auto"
                >
                  Delete Cohort
                </button>
              </div>
            </div>

            {isDeleteModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#121216] border border-red-900/60 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <h3 className="text-sm font-bold text-red-400">Delete Cohort Permanently</h3>
                    <button
                      type="button"
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="p-1 text-neutral-400 hover:text-white rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed">
                    This action <strong className="text-red-400">cannot be undone</strong>. All folders, uploaded lectures, and data belonging to this cohort will be destroyed.
                  </p>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1.5">
                      Type <span className="text-white font-mono font-bold select-all">{currentCohort.title}</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmationInput}
                      onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                      placeholder={currentCohort.title}
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-red-500"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800/80">
                    <button
                      type="button"
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-medium rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        deleteConfirmationInput.trim() !== currentCohort.title.trim() ||
                        deleteCohortMutation.isPending
                      }
                      onClick={() => deleteCohortMutation.mutate()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      {deleteCohortMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Delete Cohort Permanently</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isConfirmSaveOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#121216] border border-neutral-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                  <h3 className="text-base font-bold text-white">Confirm Changes</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Are you sure you want to update the public pricing, schedule, and course details for{" "}
                    <span className="text-white font-semibold">"{currentCohort.title}"</span>? These changes will reflect immediately on the checkout and course discovery pages.
                  </p>

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setIsConfirmSaveOpen(false);
                        setPendingCohortUpdates(null);
                      }}
                      className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-medium rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={updateCohortMutation.isPending}
                      onClick={() => {
                        if (pendingCohortUpdates) {
                          updateCohortMutation.mutate(pendingCohortUpdates);
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      {updateCohortMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Yes, Save Changes</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Cohort Analytics Coming Soon</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
              We are building metrics for student completion trends, live stream watch drop-offs, and attendance percentages.
            </p>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-neutral-800 rounded-2xl w-full max-w-xl p-6 sm:p-7 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Launch New Cohort
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Initializes in Draft state. You can manage syllabus and publish when ready.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isCreateFormValid) {
                  createCohortMutation.mutate();
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Cohort Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Full Stack & Web3 Cohort 3.0"
                  className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                    Start Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                    Delivery Type
                  </label>
                  <select
                    value={newDeliveryType}
                    onChange={(e) =>
                      setNewDeliveryType(e.target.value as "LIVE" | "RECORDED" | "HYBRID")
                    }
                    className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="LIVE">Live Interactive</option>
                    <option value="RECORDED">Recorded</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                    Selling Price (₹) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="2999"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                    Original Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newOriginalPrice}
                    onChange={(e) =>
                      setNewOriginalPrice(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="4999"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                    Validity
                  </label>
                  <input
                    type="text"
                    value={newValidity}
                    onChange={(e) => setNewValidity(e.target.value)}
                    placeholder="3 years from date of purchase"
                    className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                    Thumbnail Image URL
                  </label>
                  <input
                    type="url"
                    value={newThumbnail}
                    onChange={(e) => setNewThumbnail(e.target.value)}
                    placeholder="https://.../banner.png"
                    className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Learn full-stack web development and open source contributions from scratch..."
                  className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 leading-relaxed"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!isCreateFormValid || createCohortMutation.isPending}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 mt-2 shadow-sm"
              >
                {createCohortMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {createCohortMutation.isPending
                    ? "Creating..."
                    : !isCreateFormValid
                    ? "Fill required fields to continue"
                    : "Create Cohort (Draft)"}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};