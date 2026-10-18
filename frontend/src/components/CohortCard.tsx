import React from "react";
import { Link } from "react-router-dom";
import { Radio, ArrowRight, UserCheck } from "lucide-react";

export interface CohortItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string | null;
  price?: number;
  status: string;
  isLiveActive: boolean;
  instructor?: {
    id: string;
    name: string;
    avatar: string | null;
    email?: string;
  };
}

export const CohortCard: React.FC<{ cohort: CohortItem }> = ({ cohort }) => {
  const priceValue = cohort.price ?? 0;
  const formattedPrice = priceValue.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  return (
    <Link
      to={`/cohorts/${cohort.slug}`}
      className="group flex flex-col bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer text-left"
    >
      {/* Top Banner */}
      <div className="h-48 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black p-6 flex flex-col justify-between relative border-b border-neutral-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-neutral-950/80 border border-neutral-700 text-neutral-300 uppercase tracking-wider">
            {cohort.status.replace("_", " ")}
          </span>
          {cohort.isLiveActive && (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-red-950 text-red-400 border border-red-800 animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              LIVE
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
          <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-2">
            {cohort.title}
          </h3>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 flex-1 flex flex-col justify-between gap-6">
        <p className="text-neutral-400 text-sm line-clamp-3 leading-relaxed">
          {cohort.description}
        </p>

        <div className="space-y-4 pt-4 border-t border-neutral-800/80">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-neutral-500 block uppercase font-medium">Price</span>
              <span className="text-xl font-extrabold text-white">{formattedPrice}</span>
            </div>
            {cohort.instructor && (
              <div className="text-right">
                <span className="text-xs text-neutral-500 block uppercase font-medium">Mentor</span>
                <span className="text-sm font-medium text-neutral-300 truncate max-w-[120px] block">
                  {cohort.instructor.name}
                </span>
              </div>
            )}
          </div>

          <div className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 group-hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition-colors shadow-sm">
            <span>View Syllabus & Enroll</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
};