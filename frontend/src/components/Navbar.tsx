import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, ShieldCheck, User as UserIcon, BookOpen, Layers } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Guard: Completely strip Navbar from onboarding flows
  if (location.pathname.startsWith("/onboard")) {
    return null;
  }

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/login");
  };

  return (
    <nav className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-indigo-600 text-white p-1.5 rounded-lg text-sm font-black">BC</span>
            Bootcamp
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400">
            <Link to="/explore" className="hover:text-white transition-colors">
              Explore Cohorts
            </Link>
            {isAuthenticated && (
              <Link to="/dashboard" className="hover:text-white transition-colors">
                My Learning
              </Link>
            )}
            {isAuthenticated && (user?.role === "INSTRUCTOR" || user?.role === "ADMIN") && (
              <Link to="/instructor" className="hover:text-white transition-colors">
                Instructor Hub
              </Link>
            )}
            {isAuthenticated && user?.role === "ADMIN" && (
              <Link
                to="/admin"
                className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5 font-semibold"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Hub</span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated && user ? (
            <div className="relative group">
              {/* Clean Profile Trigger Button */}
              <button
                type="button"
                className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-full hover:bg-neutral-800/60 transition-colors focus:outline-none cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-neutral-800">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-medium text-neutral-300">
                  {user.name}
                </span>
              </button>

              {/* Hover / Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#121216] border border-neutral-800 p-2 shadow-2xl opacity-0 translate-y-1 invisible group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-all duration-200 z-50">
                {/* User Header */}
                <div className="px-3 py-2 border-b border-neutral-800/80 mb-1">
                  <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                  <p className="text-[11px] font-mono text-neutral-400 truncate">{user.email}</p>
                </div>

                {/* Navigation Options */}
                <div className="space-y-0.5 text-xs">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/70 transition-colors"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Account Settings</span>
                  </Link>

                  <Link
                    to="/dashboard"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/70 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                    <span>My Learning</span>
                  </Link>

                  {(user.role === "INSTRUCTOR" || user.role === "ADMIN") && (
                    <Link
                      to="/instructor"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/70 transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Instructor Hub</span>
                    </Link>
                  )}

                  {user.role === "ADMIN" && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/70 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                      <span>Admin Hub</span>
                    </Link>
                  )}
                </div>

                {/* Logout Option */}
                <div className="border-t border-neutral-800/80 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-medium text-neutral-300 hover:text-white px-3 py-2 rounded-lg transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                Join Now
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};