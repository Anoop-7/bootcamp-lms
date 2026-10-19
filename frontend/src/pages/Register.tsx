import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { AlertCircle, Loader2 } from "lucide-react";

export const Register: React.FC = () => {
  const [step, setStep] = useState<"INPUT" | "OTP">("INPUT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await api.post("/auth/register/initiate", {
        name,
        email,
        password,
        role: "STUDENT",
      });

      if (res.data?.data?.devOtp) {
        setDevOtp(res.data.data.devOtp);
      }
      setStep("OTP");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to initiate registration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await api.post("/auth/register/verify", {
        name,
        email,
        password,
        otp,
        role: "STUDENT",
      });

      const { token, user } = res.data.data;
      login(token, user);
      navigate("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Invalid or expired OTP code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-white tracking-tight">Create your account</h2>
        <p className="text-sm text-neutral-400 mt-1 mb-6">
          {step === "INPUT"
            ? "Start your hands-on engineering journey"
            : `Verification code sent to ${email}`}
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-sm text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {devOtp && (
          <div className="mb-4 p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-xs text-amber-300 flex flex-col gap-1">
            <div className="flex items-center justify-between font-semibold">
              <span>Development Code</span>
              <span className="font-mono bg-amber-900/50 px-2 py-0.5 rounded text-amber-200">{devOtp}</span>
            </div>
            <p className="text-[11px] text-amber-400/80">
              SMTP dispatch skipped or failed. Use this code to verify.
            </p>
          </div>
        )}

        {step === "INPUT" ? (
          <form onSubmit={handleInitiate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-neutral-600"
                placeholder="Anoop Prabhakar"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-neutral-600"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-neutral-600"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? "Dispatching verification..." : "Continue with Email"}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500"
                placeholder="123456"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("INPUT")}
                className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 rounded-lg"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting || otp.length !== 6}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Verify & Create Account</span>
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-neutral-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};