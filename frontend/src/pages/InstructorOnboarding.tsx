import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  X,
  Check,
} from "lucide-react";

export const InstructorOnboarding: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { login, logout } = useAuth();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // 1. Verify Token on Page Load (Disabled once completion is triggered)
  const {
    data: inviteData,
    isLoading: isVerifying,
    error: verificationError,
  } = useQuery({
    queryKey: ["verify-invite", token],
    queryFn: async () => {
      const res = await api.get(`/auth/invites/${token}`);
      return res.data.data;
    },
    enabled: !!token && !isCompleted,
    retry: false,
    staleTime: Infinity, // Avoid background refetching after acceptance
  });

  useEffect(() => {
    if (inviteData?.userExists && inviteData.existingName) {
      setName(inviteData.existingName);
    }
  }, [inviteData]);

  // Real-Time Form Validation
  const isExistingUser = Boolean(inviteData?.userExists);
  const isPasswordLengthValid = password.length >= 6;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isNameValid = name.trim().length > 0;

  const isFormValid = isExistingUser
    ? password.length > 0
    : isNameValid && isPasswordLengthValid && passwordsMatch;

  // 2. Submit Mutation
  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/auth/register-invited-instructor", {
        token,
        name: name.trim(),
        password,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setIsCompleted(true);
      logout();
      login(data.token, data.user);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Activation failed");
    },
  });

  const handleFinishRedirect = () => {
    queryClient.clear();
    navigate("/instructor", { replace: true });
  };

  useEffect(() => {
    if (!isCompleted) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinishRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isCompleted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setFormError("");
    registerMutation.mutate();
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="bg-[#121216] border border-neutral-800 rounded-2xl p-8 max-w-md text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Missing Invitation Token</h2>
          <p className="text-xs text-neutral-400">
            This onboarding page requires a valid invite link issued by the platform administrator.
          </p>
          <Link
            to="/login"
            className="inline-block px-4 py-2 bg-neutral-900 border border-neutral-700 text-xs font-semibold text-neutral-200 rounded-xl hover:bg-neutral-800 transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  // SUCCESS CONFIRMATION ALWAYS HAS PRECEDENCE OVER VERIFICATION STATES
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="bg-[#121216] border border-emerald-900/50 rounded-2xl w-full max-w-md p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 bg-emerald-950/80 border border-emerald-800/80 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 shadow-lg">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Onboarding Complete!
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Your instructor workspace has been provisioned. Redirecting in{" "}
              <span className="font-mono font-bold text-indigo-400">{countdown}s</span>...
            </p>
          </div>

          <button
            type="button"
            onClick={handleFinishRedirect}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Enter Instructor Hub Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (verificationError) {
    const errMessage =
      (verificationError as any)?.response?.data?.message ||
      "Invalid or expired invitation link.";

    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="bg-[#121216] border border-red-900/60 rounded-2xl p-8 max-w-md text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Invitation Unavailable</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">{errMessage}</p>
          <Link
            to="/login"
            className="inline-block px-4 py-2 bg-neutral-900 border border-neutral-700 text-xs font-semibold text-neutral-200 rounded-xl hover:bg-neutral-800 transition-colors"
          >
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
      <div className="bg-[#121216] border border-neutral-800/80 rounded-2xl w-full max-w-md p-7 sm:p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            {inviteData?.role === "ADMIN" ? "Administrator Setup" : "Instructor Onboarding"}
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {isExistingUser
              ? `Upgrade to ${inviteData?.role === "ADMIN" ? "Admin" : "Instructor"}`
              : `Set Up ${inviteData?.role === "ADMIN" ? "Admin" : "Instructor"} Account`}
          </h1>
          <p className="text-xs text-neutral-400">
            Invited by <span className="text-neutral-200 font-medium">{inviteData?.invitedBy}</span>
          </p>
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1">
              Assigned Email
            </label>
            <div className="w-full px-3.5 py-2.5 bg-neutral-900/60 border border-neutral-800 rounded-xl text-neutral-300 text-xs font-mono flex items-center justify-between">
              <span>{inviteData?.email}</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              disabled={isExistingUser}
              className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1">
              {isExistingUser ? "Current Account Password" : "Set Password"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isExistingUser ? "Enter your password to verify" : "Min 6 characters"}
              className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              required
            />
            {!isExistingUser && password.length > 0 && !isPasswordLengthValid && (
              <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Password must be at least 6 characters
              </p>
            )}
          </div>

          {!isExistingUser && (
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                className={`w-full px-3.5 py-2 bg-neutral-950 border rounded-xl text-white text-xs focus:outline-none transition-colors ${
                  confirmPassword.length === 0
                    ? "border-neutral-800 focus:border-indigo-500"
                    : passwordsMatch
                    ? "border-emerald-700/80 focus:border-emerald-500"
                    : "border-red-800/80 focus:border-red-500"
                }`}
                required
              />

              {confirmPassword.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                  {passwordsMatch ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Passwords match!
                    </span>
                  ) : (
                    <span className="text-red-400 font-medium flex items-center gap-1">
                      <X className="w-3.5 h-3.5" />
                      Passwords do not match yet
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!isFormValid || registerMutation.isPending}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {registerMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>
              {registerMutation.isPending
                ? "Provisioning Account..."
                : isExistingUser
                ? `Confirm & Upgrade to ${inviteData?.role}`
                : !isFormValid
                ? "Fill all fields correctly to proceed"
                : `Activate ${inviteData?.role === "ADMIN" ? "Admin" : "Instructor"} Account`}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};