import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CohortCard, type CohortItem } from "../components/CohortCard";
import { Search, Sparkles } from "lucide-react";

export const Explore: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: cohorts, isLoading, error } = useQuery<CohortItem[]>({
    queryKey: ["public-cohorts"],
    queryFn: async () => {
      const res = await api.get("/cohorts");
      return res.data.data;
    },
  });

  const filteredCohorts = cohorts?.filter((cohort) =>
    cohort.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cohort.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cohort.instructor?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
      {/* Catalog Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          Course Catalog
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Choose your learning path
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          Hands-on cohorts from full-stack to DevOps and Web3—get ready with structured, project-based programs.
        </p>

        {/* Search Bar */}
        <div className="relative max-w-md mx-auto pt-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses, topics, or mentors..."
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
          />
        </div>
      </div>

      {/* Cohorts Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 bg-neutral-900 border border-neutral-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-sm text-center">
          Unable to fetch cohorts at this time.
        </div>
      ) : filteredCohorts && filteredCohorts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredCohorts.map((cohort) => (
            <CohortCard key={cohort.id} cohort={cohort} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-neutral-800 rounded-2xl bg-neutral-900/30">
          <p className="text-neutral-400 text-sm">No cohorts match your search criteria.</p>
        </div>
      )}
    </div>
  );
};