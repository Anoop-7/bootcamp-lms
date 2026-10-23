import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Radio, Loader2, AlertCircle, ExternalLink, ArrowLeft } from "lucide-react";

interface ApiErrorShape {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}

export const JoinLive: React.FC = () => {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      navigate(`/login?redirect=/cohorts/${cohortId}/join-live`, { replace: true });
      return;
    }

    async function fetchSession() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await api.get(`/cohorts/${cohortId}/join-live`);
        const rawUrl = res.data?.data?.liveUrl || res.data?.data?.meetingUrl;

        if (!rawUrl) {
          throw new Error("No meeting URL found for this live session.");
        }

        const formattedUrl =
          rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
            ? rawUrl
            : `https://${rawUrl}`;

        setMeetingUrl(formattedUrl);
        setLoading(false);

        const openedWindow = window.open(formattedUrl, "_blank", "noopener,noreferrer");
        if (openedWindow) {
          openedWindow.focus();
        }
      } catch (err: unknown) {
        const error = err as ApiErrorShape;
        setErrorMsg(error.response?.data?.message || error.message || "Failed to join live session.");
        setLoading(false);
      }
    }

    if (cohortId) {
      fetchSession();
    }
  }, [cohortId, isAuthenticated, isAuthLoading, navigate]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#050507] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0e0e11] border border-neutral-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
        <div className="w-14 h-14 bg-red-950/50 border border-red-800/80 rounded-2xl flex items-center justify-center mx-auto text-red-400">
          <Radio className="w-7 h-7 animate-pulse" />
        </div>

        {loading && (
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Connecting to Live Class...</h2>
            <p className="text-xs text-neutral-400">
              Verifying enrollment permissions and logging attendance...
            </p>
            <Loader2 className="w-6 h-6 animate-spin text-red-500 mx-auto mt-4" />
          </div>
        )}

        {errorMsg && (
          <div className="space-y-4">
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2 text-left">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <Link
              to={`/cohorts/${cohortId}/learn`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs rounded-xl transition-colors text-neutral-300"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Course Player</span>
            </Link>
          </div>
        )}

        {meetingUrl && !loading && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Meeting Launched</h2>
              <p className="text-xs text-neutral-400">
                Your live class has been opened in a new tab. If it did not launch automatically, click below:
              </p>
            </div>
            <a
              href={meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs rounded-xl transition-all shadow-md"
            >
              <span>Open Meeting Window</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <div className="pt-2">
              <Link
                to={`/cohorts/${cohortId}/learn`}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Course Curriculum</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};