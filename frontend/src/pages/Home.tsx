import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Sparkles, ArrowRight, BookOpen, Compass, Video, Code, ShieldCheck } from "lucide-react";

export const Home: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-neutral-950 text-neutral-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32 border-b border-neutral-800/80 bg-gradient-to-b from-neutral-900/40 via-neutral-950 to-neutral-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            {isAuthenticated ? `Welcome back, ${user?.name || "Engineer"}` : "Next-Generation Engineering Cohorts"}
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1] max-w-4xl mx-auto">
            Master Full-Stack & Distributed Systems from First Principles
          </h1>

          <p className="mt-6 text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Live interactive weekend architecture sessions, deep-dive code reviews, and enterprise cloud infrastructure projects built for real-world engineers.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20"
              >
                <BookOpen className="w-4 h-4" />
                <span>Go to Purchases / My Learning</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : null}

            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
            >
              <Compass className="w-4 h-4 text-indigo-400" />
              <span>Browse Courses</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Value Proposition Grid (Replaces floating footer text) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Live Interactive Sessions</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Engage directly with senior engineers during live weekend architecture breakdowns and Q&A streams.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Code className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Production Codebases</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Build scalable systems using Node, Go, Kafka, Redis, and Docker with complete repository access.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Role-Based Access & Hubs</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Manage your cohort modules, track student attendance, and access your personal learning library effortlessly.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};