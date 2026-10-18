import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Folder as FolderIcon,
  PlayCircle,
  CheckCircle,
  Lock,
  ArrowRight,
  Radio,
  Loader2,
  ShieldCheck,
} from "lucide-react";

export const CohortDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const { data: cohort, isLoading, error } = useQuery({
    queryKey: ["cohort-detail", slug],
    queryFn: async () => {
      const res = await api.get(`/cohorts/${slug}`);
      return res.data.data;
    },
    enabled: !!slug,
  });

  const enrollMutation = useMutation({
    mutationFn: async (cohortId: string) => {
      const res = await api.post(`/cohorts/${cohortId}/enroll`);
      return res.data.data;
    },
    onSuccess: () => {
      if (!cohort) return;
      queryClient.invalidateQueries({ queryKey: ["cohort-detail", slug] });
      queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", cohort.id] });
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });

      // Navigate to classroom player
      navigate(`/cohorts/${cohort.id}/learn`);
    },
    onError: (err: any) => {
      if (err.response?.status === 409 && cohort) {
        queryClient.invalidateQueries({ queryKey: ["cohort-curriculum", cohort.id] });
        navigate(`/cohorts/${cohort.id}/learn`);
      } else {
        setEnrollError(err.response?.data?.message || "Failed to complete enrollment");
      }
    },
  });

  // Access & Ownership Evaluation
  const isOwner = Boolean(user && cohort && cohort.instructorId === user.id);
  const isAdmin = user?.role === "ADMIN";
  const isEnrolled = Boolean(cohort?.isEnrolled);
  const hasAccess = isOwner || isAdmin || isEnrolled;

  const handleEnrollClick = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (isOwner || hasAccess) {
      navigate(`/cohorts/${cohort?.id}/learn`);
      return;
    }
    if (cohort) {
      enrollMutation.mutate(cohort.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-white">Cohort Not Found</h2>
        <p className="text-neutral-400 text-sm mt-2 mb-6">The requested syllabus could not be retrieved.</p>
        <Link to="/" className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm">
          Return Home
        </Link>
      </div>
    );
  }

  const priceValue = cohort.price ?? 0;
  const formattedPrice = priceValue.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300 uppercase tracking-wider">
                {cohort.status?.replace("_", " ")}
              </span>
              {cohort.isLiveActive && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-red-950 text-red-400 border border-red-800 animate-pulse">
                  <Radio className="w-3.5 h-3.5" />
                  Live Stream Active
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {cohort.title}
            </h1>

            <p className="mt-4 text-base text-neutral-400 leading-relaxed">
              {cohort.description}
            </p>
          </div>

          {cohort.instructor && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm font-bold text-white">
                {cohort.instructor.name?.charAt(0)}
              </div>
              <div>
                <span className="text-xs text-neutral-500 uppercase font-semibold">Taught By</span>
                <h4 className="text-sm font-bold text-white">{cohort.instructor.name}</h4>
                <p className="text-xs text-neutral-400">{cohort.instructor.email}</p>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-white mb-4">Curriculum Breakdown</h2>
            <div className="border border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-800/80 bg-neutral-900/40">
              {cohort.folders && cohort.folders.length > 0 ? (
                cohort.folders.map((folder: any) => (
                  <div key={folder.id} className="p-5">
                    <div className="flex items-center gap-2 font-semibold text-sm text-neutral-200 mb-3">
                      <FolderIcon className="w-4 h-4 text-indigo-400" />
                      <span>{folder.title}</span>
                    </div>

                    <div className="space-y-2 pl-6">
                      {folder.contents?.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-xs text-neutral-400 py-1.5">
                          <div className="flex items-center gap-2 truncate">
                            <PlayCircle className="w-3.5 h-3.5 text-neutral-500" />
                            <span className="truncate">{c.title}</span>
                          </div>
                          {!hasAccess && <Lock className="w-3 h-3 text-neutral-600 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-neutral-500">
                  Curriculum preview is being prepared by the mentor.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl">
            <span className="text-xs text-neutral-500 block uppercase font-medium">Registration Fee</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{formattedPrice}</span>
              <span className="text-xs text-neutral-400">inclusive of all taxes</span>
            </div>

            {enrollError && (
              <div className="mt-4 p-3 bg-red-950/60 border border-red-800 text-xs text-red-300 rounded-lg">
                {enrollError}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {hasAccess ? (
                <Link
                  to={`/cohorts/${cohort.id}/learn`}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
                >
                  {isAdmin && !isOwner ? (
                    <ShieldCheck className="w-4 h-4 text-white" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-white" />
                  )}
                  <span>
                    {isOwner
                      ? "Enter Your Classroom"
                      : isAdmin
                      ? "View Classroom (Admin)"
                      : "Continue to Classroom"}
                  </span>
                </Link>
              ) : (
                <button
                  onClick={handleEnrollClick}
                  disabled={enrollMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
                >
                  {enrollMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Enroll in Cohort</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="mt-6 border-t border-neutral-800 pt-6 space-y-2.5 text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>Lifetime access to session recordings</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>Live Interactive Zoom Q&A Access</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>Curated architecture code repositories</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};