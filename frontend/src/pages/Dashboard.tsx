import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PlayCircle, Radio, BookOpen, AlertCircle, UserCheck } from "lucide-react";


interface EnrolledCohort {
  id: string;
  userId: string;
  cohortId: string;
  enrolledAt: string;
  cohort: {
    id: string;
    title: string;
    slug: string;
    description: string;
    thumbnail: string | null;
    status: string;
    isLiveActive: boolean;
    instructor?: {
      id: string;
      name: string;
      avatar: string | null;
    };
  };
}

export const Dashboard: React.FC = () => {
  const { data, isLoading, error } = useQuery<EnrolledCohort[]>({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const res = await api.get("/enrollments/my");
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="h-8 w-48 bg-neutral-800 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-neutral-900 border border-neutral-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 p-4 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Failed to load enrollments. Please try refreshing.</p>
        </div>
      </div>
    );
  }

  const enrollments = data || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">My Learning</h1>
          <p className="text-neutral-400 text-sm mt-1">Continue where you left off</p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors w-fit"
        >
          <BookOpen className="w-4 h-4" />
          Browse More Cohorts
        </Link>
      </div>

      {enrollments.length === 0 ? (
        <div className="text-center py-20 bg-neutral-900/40 border border-neutral-800 rounded-2xl p-8">
          <BookOpen className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white">No active enrollments</h3>
          <p className="text-neutral-400 text-sm mt-1 mb-6 max-w-sm mx-auto">
            You are not enrolled in any bootcamps yet. Explore available courses to get started.
          </p>
          <Link
            to="/explore"
            className="inline-flex px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition-colors shadow-sm"
          >
            Explore Cohorts
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrollments.map(({ cohort }) => (
            <Link
              key={cohort.id}
              to={`/cohorts/${cohort.id}/learn`}
              className="group flex flex-col bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl overflow-hidden transition-all shadow-sm hover:shadow-indigo-500/10 cursor-pointer text-left"
            >
              {/* Thumbnail / Header Area */}
              <div className="h-48 bg-gradient-to-br from-neutral-800 to-neutral-950 p-6 flex flex-col justify-between relative border-b border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-neutral-950/80 border border-neutral-700 text-neutral-300 uppercase tracking-wider">
                    {cohort.status.replace("_", " ")}
                  </span>
                  {cohort.isLiveActive && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-red-950 text-red-400 border border-red-800 animate-pulse">
                      <Radio className="w-3.5 h-3.5" />
                      LIVE NOW
                    </span>
                  )}
                </div>

                <div>
                  {cohort.instructor && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-indigo-400 font-medium">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>By {cohort.instructor.name}</span>
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {cohort.title}
                  </h2>
                </div>
              </div>

              {/* Description & Action */}
              <div className="p-6 flex-1 flex flex-col justify-between gap-6">
                <p className="text-neutral-400 text-sm line-clamp-3 leading-relaxed">
                  {cohort.description}
                </p>

                <div className="space-y-3">
                  {cohort.isLiveActive && (
                    <Link
                      to={`/cohorts/${cohort.id}/join-live`}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm rounded-lg transition-colors shadow-sm"
                    >
                      <Radio className="w-4 h-4" />
                      <span>Join Live Lecture</span>
                    </Link>
                  )}

                  <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-800 group-hover:bg-neutral-700 text-white font-medium text-sm rounded-lg transition-colors border border-neutral-700">
                    <PlayCircle className="w-4 h-4 text-indigo-400" />
                    <span>Open Course Player</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};