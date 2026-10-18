import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  ShieldCheck,
  UserPlus,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Mail,
  Users,
  RotateCcw,
  Trash2,
  Ban,
  Layers,
  GraduationCap,
  X,
  BookOpen,
} from "lucide-react";

interface InstructorInviteItem {
  id: string;
  email: string;
  token: string;
  role: "INSTRUCTOR" | "ADMIN";
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string | null;
  currentRole?: "STUDENT" | "INSTRUCTOR" | "ADMIN" | null;
  invitedBy: {
    name: string;
    email: string;
  };
}

interface PlatformUserItem {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  createdAt: string;
  _count: {
    cohortsTeaching: number;
    enrollments: number;
  };
}

interface AdminCohortItem {
  id: string;
  title: string;
  price: number;
  status: "UPCOMING_LIVE" | "ONGOING_LIVE" | "COMPLETED_LIVE" | "SELF_PACED";
  isLiveActive: boolean;
  createdAt: string;
  instructor: {
    id: string;
    name: string;
    email: string;
  };
  _count: {
    enrollments: number;
    folders: number;
    orders: number;
  };
}

interface StudentEnrollmentItem {
  id: string;
  enrolledAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export const AdminDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"invites" | "users" | "cohorts">("invites");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"INSTRUCTOR" | "ADMIN">("INSTRUCTOR");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);

  // Cohort Modal State
  const [selectedCohort, setSelectedCohort] = useState<AdminCohortItem | null>(null);
  const [manualEnrollEmail, setManualEnrollEmail] = useState("");

  const handleTabSwitch = (tab: "invites" | "users" | "cohorts") => {
    setActiveTab(tab);
    setLatestInviteUrl(null);
    if (tab === "invites") queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    if (tab === "users") queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    if (tab === "cohorts") queryClient.invalidateQueries({ queryKey: ["admin-cohorts"] });
  };

  // Queries
  const { data: invites, isLoading: isInvitesLoading } = useQuery<InstructorInviteItem[]>({
    queryKey: ["admin-invites"],
    queryFn: async () => {
      const res = await api.get("/admin/invites");
      return res.data.data;
    },
    enabled: activeTab === "invites",
  });

  const { data: users, isLoading: isUsersLoading } = useQuery<PlatformUserItem[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await api.get("/admin/users");
      return res.data.data;
    },
    enabled: activeTab === "users",
  });

  const { data: cohorts, isLoading: isCohortsLoading } = useQuery<AdminCohortItem[]>({
    queryKey: ["admin-cohorts"],
    queryFn: async () => {
      const res = await api.get("/admin/cohorts");
      return res.data.data;
    },
    enabled: activeTab === "cohorts",
  });

  const { data: enrollments, isLoading: isEnrollmentsLoading } = useQuery<StudentEnrollmentItem[]>({
    queryKey: ["cohort-enrollments", selectedCohort?.id],
    queryFn: async () => {
      const res = await api.get(`/admin/cohorts/${selectedCohort?.id}/enrollments`);
      return res.data.data;
    },
    enabled: !!selectedCohort,
  });

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: string }) => {
      const res = await api.post("/admin/invites", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      setLatestInviteUrl(data.inviteUrl);
      setInviteEmail("");
    },
    onError: (err: any) => alert(err.response?.data?.message || "Failed to generate invite"),
  });

  const tableReinviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: string }) => {
      const res = await api.post("/admin/invites", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      navigator.clipboard.writeText(data.inviteUrl);
      setCopiedId(data.inviteId);
      setTimeout(() => setCopiedId(null), 3000);
      alert(`A fresh invite for ${data.email} (${data.role}) has been created and copied to your clipboard.`);
    },
    onError: (err: any) => alert(err.response?.data?.message || "Failed to re-invite"),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/admin/invites/${id}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    },
    onError: (err: any) => alert(err.response?.data?.message || "Failed to revoke invite"),
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/admin/invites/${id}/resend`);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      navigator.clipboard.writeText(data.inviteUrl);
      setCopiedId(data.inviteId);
      setTimeout(() => setCopiedId(null), 3000);
      alert(`Invite link renewed for 48 hours and copied to clipboard.`);
    },
    onError: (err: any) => alert(err.response?.data?.message || "Failed to re-arm invite"),
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/invites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    },
    onError: (err: any) => alert(err.response?.data?.message || "Failed to delete invite"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await api.patch(`/admin/users/${userId}/role`, { role });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      alert("User role updated successfully.");
    },
    onError: (err: any) => alert(err.response?.data?.message || "Failed to update role"),
  });

  const updateCohortStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/admin/cohorts/${id}/status`, { status });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cohorts"] });
    },
    onError: (err: any) => alert(err.response?.data?.message || "Failed to update cohort status"),
  });

  const manualEnrollMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await api.post(`/admin/cohorts/${selectedCohort?.id}/enroll`, { email });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-enrollments", selectedCohort?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-cohorts"] });
      setManualEnrollEmail("");
      alert("Student manually enrolled!");
    },
    onError: (err: any) => alert(err.response?.data?.message || "Failed to enroll student"),
  });

  const revokeEnrollmentMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/admin/cohorts/${selectedCohort?.id}/enroll/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-enrollments", selectedCohort?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-cohorts"] });
    },
    onError: (err: any) => alert(err.response?.data?.message || "Failed to revoke enrollment"),
  });

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getStatusBadge = (inv: InstructorInviteItem) => {
    switch (inv.status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/60">
            <Clock className="w-3 h-3" />
            Pending (Active)
          </span>
        );
      case "ACCEPTED":
        if (inv.currentRole && inv.currentRole !== inv.role) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 text-zinc-400 border border-zinc-700">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              Accepted (Demoted to {inv.currentRole})
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3" />
            Accepted (Active)
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-900 text-neutral-400 border border-neutral-800">
            <AlertCircle className="w-3 h-3" />
            Expired
          </span>
        );
      case "REVOKED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-950/60 text-red-400 border border-red-800/60">
            <XCircle className="w-3 h-3" />
            Revoked
          </span>
        );
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#09090b] text-neutral-100">
      {/* Top Banner */}
      <div className="border-b border-neutral-800 bg-[#0f0f12]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800/60 uppercase tracking-wider">
              Platform Administration
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-red-400" />
            Admin Dashboard
          </h1>
          <p className="text-neutral-400 text-xs mt-0.5">
            Manage platform security, invite instructors, assign admin roles, and govern cohorts.
          </p>

          {/* Sub Navigation */}
          <div className="flex items-center gap-3 mt-6 border-t border-neutral-800/80 pt-4">
            <button
              onClick={() => handleTabSwitch("invites")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "invites"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Privileged Onboarding Ledger</span>
            </button>

            <button
              onClick={() => handleTabSwitch("users")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "users"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Platform Users & Roles</span>
            </button>

            <button
              onClick={() => handleTabSwitch("cohorts")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "cohorts"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Cohort & Enrollment Governance</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* TAB 1: INVITES */}
        {activeTab === "invites" && (
          <>
            <div className="bg-[#121216] border border-neutral-800/80 rounded-2xl p-6 shadow-xl space-y-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  Issue Privileged Onboarding Invite
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Generates a single-use onboarding URL valid for 48 hours for an Instructor or Administrator.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inviteEmail.trim()) {
                    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
                  }
                }}
                className="flex flex-col sm:flex-row gap-3 max-w-xl"
              >
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="candidate@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "INSTRUCTOR" | "ADMIN")}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-200 outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Administrator</option>
                </select>

                <button
                  type="submit"
                  disabled={inviteMutation.isPending || !inviteEmail.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                >
                  {inviteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>Generate Link</span>
                </button>
              </form>

              {latestInviteUrl && (
                <div className="mt-4 p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/60 space-y-2 relative">
                  <button
                    onClick={() => setLatestInviteUrl(null)}
                    className="absolute top-3 right-3 text-neutral-400 hover:text-white p-1 rounded-lg"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center justify-between pr-6">
                    <span className="text-xs font-semibold text-indigo-300">
                      Invite Link Generated (48-hour Expiry)
                    </span>
                    <span className="text-[10px] text-indigo-400 uppercase font-mono">1-Time Use Only</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={latestInviteUrl}
                      className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 font-mono text-xs select-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(latestInviteUrl, "latest")}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0"
                    >
                      {copiedId === "latest" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#121216] border border-neutral-800/80 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Privileged Invitations Ledger
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    History of onboarding tokens, target roles, state transitions, and audit records.
                  </p>
                </div>
                <span className="text-xs text-neutral-400 font-medium">
                  {invites?.length || 0} Total Invites
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-900/60 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Candidate & Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Invited By</th>
                      <th className="py-3 px-4">Expires At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {isInvitesLoading ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-neutral-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                        </td>
                      </tr>
                    ) : invites && invites.length > 0 ? (
                      invites.map((inv) => {
                        const inviteUrl = `${window.location.origin}/onboard/instructor?token=${inv.token}`;
                        return (
                          <tr key={inv.id} className="hover:bg-neutral-900/30 transition-colors">
                            {/* Column 1: Candidate Email + Target Role Badge */}
                            <td className="py-3 px-4 font-mono font-medium text-neutral-200">
                              <div className="flex items-center gap-2">
                                <span>{inv.email}</span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                    inv.role === "ADMIN"
                                      ? "bg-red-950/60 text-red-400 border-red-800/60"
                                      : "bg-indigo-950/60 text-indigo-400 border-indigo-800/60"
                                  }`}
                                >
                                  {inv.role}
                                </span>
                              </div>
                            </td>

                            {/* Column 2: Status */}
                            <td className="py-3 px-4">{getStatusBadge(inv)}</td>

                            {/* Column 3: Invited By */}
                            <td className="py-3 px-4 text-neutral-400">{inv.invitedBy.name}</td>

                            {/* Column 4: Expires At */}
                            <td className="py-3 px-4 text-neutral-400">
                              {new Date(inv.expiresAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>

                            {/* Column 5: Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {inv.status === "PENDING" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyLink(inviteUrl, inv.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-[11px] font-medium transition-colors"
                                    >
                                      {copiedId === inv.id ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5 text-neutral-400" />
                                      )}
                                      <span>Copy</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Revoke invitation for ${inv.email}? The candidate will be blocked from onboarding.`
                                          )
                                        ) {
                                          revokeMutation.mutate(inv.id);
                                        }
                                      }}
                                      title="Revoke Token"
                                      className="p-1.5 bg-neutral-900 hover:bg-red-950/60 border border-neutral-700 hover:border-red-800 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                                    >
                                      <Ban className="w-3 h-3" />
                                    </button>
                                  </>
                                )}

                                {(inv.status === "EXPIRED" || inv.status === "REVOKED") && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Resend and renew 48-hour invitation for ${inv.email}?`
                                          )
                                        ) {
                                          resendMutation.mutate(inv.id);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/80 rounded-lg text-indigo-300 text-[11px] font-medium transition-colors"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>{copiedId === inv.id ? "Copied!" : "Re-arm Link"}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Permanently remove this invitation record for ${inv.email}?`
                                          )
                                        ) {
                                          deleteInviteMutation.mutate(inv.id);
                                        }
                                      }}
                                      title="Delete Invite Record"
                                      className="p-1.5 bg-neutral-900 hover:bg-red-950/60 border border-neutral-700 hover:border-red-800 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}

                                {inv.status === "ACCEPTED" && inv.currentRole === "STUDENT" ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Issue a fresh invite for ${inv.email} as ${inv.role}?`
                                          )
                                        ) {
                                          tableReinviteMutation.mutate({ email: inv.email, role: inv.role });
                                        }
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/80 rounded-lg text-indigo-300 text-[11px] font-medium transition-colors"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>{copiedId === inv.id ? "Copied!" : "Re-invite"}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Remove this spent invitation record for ${inv.email}?`
                                          )
                                        ) {
                                          deleteInviteMutation.mutate(inv.id);
                                        }
                                      }}
                                      title="Delete Record"
                                      className="p-1.5 bg-neutral-900 hover:bg-red-950/60 border border-neutral-700 hover:border-red-800 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : inv.status === "ACCEPTED" ? (
                                  <span className="text-[11px] text-emerald-400/80 font-medium px-2">
                                    Active {inv.role}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-neutral-500 italic">
                          No invitations generated yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: PLATFORM USERS & ROLE ELEVATION */}
        {activeTab === "users" && (
          <div className="bg-[#121216] border border-neutral-800/80 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  User Accounts Directory & Role Governance
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Inspect enrolled students, instructors, and elevate trusted users directly to Administrator.
                </p>
              </div>
              <span className="text-xs text-neutral-400 font-medium">
                {users?.length || 0} Registered Users
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-900/60 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Activity</th>
                    <th className="py-3 px-4">Joined Date</th>
                    <th className="py-3 px-4 text-right">Role Assignment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {isUsersLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                      </td>
                    </tr>
                  ) : users && users.length > 0 ? (
                    users.map((u) => {
                      const isSelf = u.id === currentAdmin?.id;
                      return (
                        <tr key={u.id} className="hover:bg-neutral-900/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-white">{u.name}</p>
                            <p className="font-mono text-neutral-400 text-[11px]">{u.email}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                u.role === "ADMIN"
                                  ? "bg-red-950 text-red-400 border-red-800/60"
                                  : u.role === "INSTRUCTOR"
                                  ? "bg-indigo-950 text-indigo-400 border-indigo-800/60"
                                  : "bg-neutral-900 text-neutral-400 border-neutral-800"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-neutral-400">
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className="flex items-center gap-1" title="Cohorts instructed">
                                <Layers className="w-3 h-3 text-indigo-400" />
                                {u._count.cohortsTeaching}
                              </span>
                              <span className="flex items-center gap-1" title="Enrolled courses">
                                <GraduationCap className="w-3 h-3 text-emerald-400" />
                                {u._count.enrollments}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-neutral-400 text-[11px]">
                            {new Date(u.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isSelf ? (
                              <span className="text-[11px] text-neutral-500 italic">
                                Active Admin (You)
                              </span>
                            ) : (
                              <select
                                value={u.role}
                                onChange={(e) => {
                                  if (
                                    window.confirm(
                                      `Change role of "${u.name}" (${u.email}) from ${u.role} to ${e.target.value}?`
                                    )
                                  ) {
                                    updateRoleMutation.mutate({
                                      userId: u.id,
                                      role: e.target.value,
                                    });
                                  }
                                }}
                                className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-2.5 py-1 outline-none focus:border-indigo-500 cursor-pointer"
                              >
                                <option value="STUDENT">Student</option>
                                <option value="INSTRUCTOR">Instructor</option>
                                <option value="ADMIN">Admin (Superuser)</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-500 italic">
                        No platform users registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: COHORTS & ENROLLMENT GOVERNANCE */}
        {activeTab === "cohorts" && (
          <div className="bg-[#121216] border border-neutral-800/80 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  All Platform Cohorts
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Inspect curriculum across all instructors, manage status, and oversee student enrollments.
                </p>
              </div>
              <span className="text-xs text-neutral-400 font-medium">
                {cohorts?.length || 0} Cohorts Created
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-900/60 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="py-3 px-4">Cohort Title</th>
                    <th className="py-3 px-4">Instructor</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Curriculum</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {isCohortsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                      </td>
                    </tr>
                  ) : cohorts && cohorts.length > 0 ? (
                    cohorts.map((cohort) => (
                      <tr key={cohort.id} className="hover:bg-neutral-900/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">
                          {cohort.title}
                        </td>
                        <td className="py-3 px-4 text-neutral-300">
                          <p>{cohort.instructor.name}</p>
                          <p className="text-[10px] font-mono text-neutral-500">{cohort.instructor.email}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-300">
                          ₹{cohort.price.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={cohort.status}
                            onChange={(e) =>
                              updateCohortStatusMutation.mutate({
                                id: cohort.id,
                                status: e.target.value,
                              })
                            }
                            className="bg-neutral-950 border border-neutral-800 text-neutral-300 text-[11px] rounded-lg px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="UPCOMING_LIVE">UPCOMING_LIVE</option>
                            <option value="ONGOING_LIVE">ONGOING_LIVE</option>
                            <option value="COMPLETED_LIVE">COMPLETED_LIVE</option>
                            <option value="SELF_PACED">SELF_PACED</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-neutral-400">
                          {cohort._count.folders} Modules
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedCohort(cohort)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/80 rounded-lg text-indigo-300 text-[11px] font-medium transition-colors"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Roster ({cohort._count.enrollments})</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-500 italic">
                        No cohorts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ROSTER & MANUAL ENROLLMENT MODAL */}
        {selectedCohort && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#121216] border border-neutral-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl relative">
              <button
                onClick={() => setSelectedCohort(null)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>

              <div>
                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                  Cohort Enrollment Roster
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {selectedCohort.title}
                </h3>
              </div>

              {/* Add Student by Email */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualEnrollEmail.trim()) {
                    manualEnrollMutation.mutate(manualEnrollEmail.trim());
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="email"
                  value={manualEnrollEmail}
                  onChange={(e) => setManualEnrollEmail(e.target.value)}
                  placeholder="Enter student email to manually grant access..."
                  className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
                <button
                  type="submit"
                  disabled={manualEnrollMutation.isPending || !manualEnrollEmail.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                >
                  {manualEnrollMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Enroll</span>
                </button>
              </form>

              {/* Enrolled Students Table */}
              <div className="border border-neutral-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-900/60 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Enrolled At</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {isEnrollmentsLoading ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-neutral-500">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto text-indigo-500" />
                        </td>
                      </tr>
                    ) : enrollments && enrollments.length > 0 ? (
                      enrollments.map((enr) => (
                        <tr key={enr.id} className="hover:bg-neutral-900/30">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-white">{enr.user.name}</p>
                            <p className="font-mono text-neutral-400 text-[10px]">{enr.user.email}</p>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-400 text-[11px]">
                            {new Date(enr.enrolledAt).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Revoke ${enr.user.name}'s access to ${selectedCohort.title}?`
                                  )
                                ) {
                                  revokeEnrollmentMutation.mutate(enr.user.id);
                                }
                              }}
                              className="text-red-400 hover:text-red-300 text-[11px] font-medium"
                            >
                              Revoke Access
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-neutral-500 italic">
                          No students enrolled in this cohort yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};