import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarPlus,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  solarHarvestApi,
  type BookingRecord,
  type BookingSlot,
} from "../lib/solarharvestApi";

interface AdminBookingPanelProps {
  adminToken: string | null;
  onAuthChange: (token: string | null) => void;
  logoUrl: string;
  onLogoChange: (newLogoUrl: string) => void;
  onSlotsMutated: () => void;
  refreshSignal: number;
  standalone?: boolean;
  onBackToClient?: () => void;
}

const getTomorrowIso = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatInr = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const STATUS_LABELS: Record<BookingRecord["status"], { label: string; color: string }> = {
  pending_approval: { label: "Needs Timing Approval", color: "text-[#B45309]" },
  approved_awaiting_payment: { label: "Approved · Awaiting Payment", color: "text-[#0369A1]" },
  confirmed: { label: "Paid & Slot Booked", color: "text-[#15663E]" },
  completed: { label: "Completed", color: "text-[#1D4ED8]" },
  rejected: { label: "Timing Declined", color: "text-[#B91C1C]" },
  cancelled: { label: "Cancelled", color: "text-[#64748B]" },
};

export function AdminBookingPanel({
  adminToken,
  onAuthChange,
  logoUrl,
  onLogoChange,
  onSlotsMutated,
  refreshSignal,
  standalone = false,
  onBackToClient,
}: AdminBookingPanelProps) {
  const [authStatus, setAuthStatus] = useState<"loading" | "unconfigured" | "configured">("loading");
  const [authSource, setAuthSource] = useState<"env" | "claimed" | "unconfigured">("unconfigured");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<"bookings" | "slots" | "logo">("bookings");
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Per-booking review inputs (custom fee & timing note before approving/declining)
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [reviewFees, setReviewFees] = useState<Record<number, string>>({});
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  // Add slot form state
  const [newSlotDate, setNewSlotDate] = useState(getTomorrowIso());
  const [newStartTime, setNewStartTime] = useState("10:00");
  const [newEndTime, setNewEndTime] = useState("11:00");
  const [newSlotType, setNewSlotType] = useState("SolarHarvest Site & Tech Briefing");
  const [creatingSlot, setCreatingSlot] = useState(false);

  // Logo upload state
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    solarHarvestApi
      .getAdminStatus()
      .then((res) => {
        setAuthSource(res.source);
        setAuthStatus(res.configured ? "configured" : "unconfigured");
      })
      .catch(() => {
        setAuthStatus("configured");
      });
  }, []);

  const loadAdminData = async (token: string) => {
    setLoadingData(true);
    try {
      const [bData, sData] = await Promise.all([
        solarHarvestApi.getAdminBookings(token),
        solarHarvestApi.getAdminSlots(token),
      ]);
      setBookings(bData);
      setSlots(sData);
    } catch (err: any) {
      if (
        String(err?.message || "").toLowerCase().includes("session") ||
        String(err?.message || "").includes("401")
      ) {
        onAuthChange(null);
      }
      setFeedback({ type: "error", text: err?.message || "Failed to load admin schedule." });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      loadAdminData(adminToken);
    }
  }, [adminToken, refreshSignal]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const trimmedUsername = usernameInput.trim();
    if (!trimmedUsername) {
      setAuthError("Please enter the admin username.");
      return;
    }

    if (authStatus === "unconfigured") {
      if (trimmedUsername.length < 3) {
        setAuthError("Admin username must be at least 3 characters.");
        return;
      }
      if (passwordInput.length < 8) {
        setAuthError("Please choose an admin password of at least 8 characters.");
        return;
      }
      if (passwordInput !== confirmPasswordInput) {
        setAuthError("Passwords do not match.");
        return;
      }
    }

    setAuthSubmitting(true);
    try {
      const res =
        authStatus === "unconfigured"
          ? await solarHarvestApi.claimAdminPassword(trimmedUsername, passwordInput)
          : await solarHarvestApi.loginAdmin(trimmedUsername, passwordInput);
      onAuthChange(res.token);
      setAuthStatus("configured");
      setUsernameInput("");
      setPasswordInput("");
      setConfirmPasswordInput("");
    } catch (err: any) {
      setAuthError(err?.message || "Authentication failed.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleReviewBooking = async (booking: BookingRecord, decision: "approve" | "reject") => {
    if (!adminToken) return;
    setReviewingId(booking.id);
    setFeedback(null);
    try {
      const feeStr = reviewFees[booking.id];
      const parsedFee = feeStr !== undefined && feeStr !== "" ? Number(feeStr) : booking.booking_fee;
      const res = await solarHarvestApi.reviewAdminBooking(adminToken, booking.id, {
        decision,
        adminNote: reviewNotes[booking.id] || "",
        bookingFee: decision === "approve" ? parsedFee : undefined,
      });
      setFeedback({ type: "success", text: res.message });
      await loadAdminData(adminToken);
      onSlotsMutated();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Could not review booking timing." });
    } finally {
      setReviewingId(null);
    }
  };

  const handleUpdateBookingStatus = async (
    bookingId: number,
    status: BookingRecord["status"]
  ) => {
    if (!adminToken) return;
    setFeedback(null);
    try {
      await solarHarvestApi.updateAdminBookingStatus(adminToken, bookingId, status);
      setFeedback({ type: "success", text: `Booking updated to ${STATUS_LABELS[status].label}.` });
      await loadAdminData(adminToken);
      onSlotsMutated();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Could not update booking status." });
    }
  };

  const handleCreateSingleSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setCreatingSlot(true);
    setFeedback(null);
    try {
      const res = await solarHarvestApi.createAdminSlot(adminToken, {
        slotDate: newSlotDate,
        startTime: newStartTime,
        endTime: newEndTime,
        slotType: newSlotType,
      });
      setFeedback({ type: "success", text: res.message || "Slot added." });
      await loadAdminData(adminToken);
      onSlotsMutated();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to add slot." });
    } finally {
      setCreatingSlot(false);
    }
  };

  const handleGenerateDefaultDay = async () => {
    if (!adminToken) return;
    setCreatingSlot(true);
    setFeedback(null);
    try {
      const res = await solarHarvestApi.createAdminSlot(adminToken, {
        slotDate: newSlotDate,
        slotType: newSlotType,
        bulkDefault: true,
      });
      setFeedback({ type: "success", text: res.message || "Added default day slots." });
      await loadAdminData(adminToken);
      onSlotsMutated();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to generate slots." });
    } finally {
      setCreatingSlot(false);
    }
  };

  const handleToggleSlotBlock = async (slot: BookingSlot) => {
    if (!adminToken) return;
    const nextStatus = slot.status === "blocked" ? "open" : "blocked";
    setFeedback(null);
    try {
      await solarHarvestApi.updateAdminSlotStatus(adminToken, slot.id, nextStatus);
      setFeedback({
        type: "success",
        text: `Slot ${slot.slot_date} (${slot.time_label}) marked as ${nextStatus}.`,
      });
      await loadAdminData(adminToken);
      onSlotsMutated();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Could not update slot." });
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!adminToken) return;
    setFeedback(null);
    try {
      await solarHarvestApi.deleteAdminSlot(adminToken, slotId);
      setFeedback({ type: "success", text: "Slot removed from schedule." });
      await loadAdminData(adminToken);
      onSlotsMutated();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Could not delete slot." });
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adminToken) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setFeedback({ type: "error", text: "Please upload a PNG, JPG, or WebP logo image." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: "error", text: "Logo file must be under 2 MB." });
      return;
    }
    setLogoUploading(true);
    setFeedback(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        const res = await solarHarvestApi.updateWebsiteLogo(adminToken, dataUrl);
        onLogoChange(res.logoUrl);
        setFeedback({ type: "success", text: "Website logo updated across the application." });
      } catch (err: any) {
        setFeedback({ type: "error", text: err?.message || "Failed to save logo." });
      } finally {
        setLogoUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = async () => {
    if (!adminToken) return;
    setLogoUploading(true);
    setFeedback(null);
    try {
      await solarHarvestApi.updateWebsiteLogo(adminToken, "");
      onLogoChange("");
      setFeedback({ type: "success", text: "Website logo reset to default." });
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to reset logo." });
    } finally {
      setLogoUploading(false);
    }
  };

  const filteredBookings = useMemo(() => {
    if (statusFilter === "all") return bookings;
    return bookings.filter((b) => b.status === statusFilter);
  }, [bookings, statusFilter]);

  const metrics = useMemo(() => {
    const awaitingApproval = bookings.filter((b) => b.status === "pending_approval").length;
    const awaitingPayment = bookings.filter((b) => b.status === "approved_awaiting_payment").length;
    const paidBooked = bookings.filter((b) => b.status === "confirmed" || b.status === "completed").length;
    const openSlots = slots.filter((s) => s.status === "open").length;
    return {
      awaitingApproval,
      awaitingPayment,
      paidBooked,
      openSlots,
    };
  }, [slots, bookings]);

  return (
    <section
      id="admin-login"
      className={`border-t border-[#DDE3D8] bg-[#FFFFFF] ${
        standalone ? "min-h-[calc(100vh-4rem)] py-14 sm:py-16" : "py-20 sm:py-24"
      }`}
    >
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#15663E]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin Login · Slot Timing Approval &amp; Schedule Control
            </p>
            <h2
              className="mt-2 text-3xl font-semibold tracking-tight text-[#132219] sm:text-4xl"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                textWrap: "balance",
              }}
            >
              {adminToken ? "Admin Slot Approval Dashboard" : "Admin Login"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#4A5D51]">
              {adminToken
                ? "Review every person who requested a slot, approve whether the slot timing is OK to unlock client payment, and manage available schedule windows."
                : "Administrators can sign in here to view all slot booking requests, approve or decline slot timings, and track client payments."}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {standalone && onBackToClient && (
              <button
                type="button"
                onClick={onBackToClient}
                className="inline-flex min-h-[40px] items-center rounded-lg border border-[#C9D3C3] bg-[#F7F8F5] px-4 py-2 text-xs font-semibold text-[#132219] hover:border-[#15663E] whitespace-nowrap shrink-0"
              >
                Client Page
              </button>
            )}
            {adminToken && (
              <>
                <button
                  type="button"
                  onClick={() => loadAdminData(adminToken)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#DDE3D8] bg-[#F7F8F5] px-3.5 py-2 text-xs font-semibold text-[#2A3B31] hover:border-[#15663E] whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => onAuthChange(null)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#DDE3D8] bg-[#FFFFFF] px-3.5 py-2 text-xs font-semibold text-[#9A3412] hover:border-red-300 whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>

        {/* Admin Auth Gate */}
        {!adminToken ? (
          <div className="max-w-md rounded-2xl border border-[#DDE3D8] bg-[#F7F8F5] p-7 sm:p-8">
            <div className="mb-6 flex items-center gap-3 text-[#15663E]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDE3D8] bg-[#FFFFFF]">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3
                  className="text-lg font-semibold text-[#132219]"
                  style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                >
                  {authStatus === "unconfigured" ? "First-Time Admin Setup" : "Sign In as Admin"}
                </h3>
                <p className="text-xs text-[#596D60]">
                  {authStatus === "unconfigured"
                    ? "Create admin credentials to review and approve bookings."
                    : authSource === "env"
                    ? "Enter the server-configured admin credentials."
                    : "Enter your admin username and password to manage bookings."}
                </p>
              </div>
            </div>

            {authStatus === "loading" ? (
              <p className="py-4 text-sm text-[#596D60]">Checking admin access...</p>
            ) : (
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="admin-username"
                    className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                  >
                    {authStatus === "unconfigured" ? "Create Admin Username" : "Admin Username"}
                  </label>
                  <input
                    id="admin-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Enter admin username"
                    className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-pass"
                    className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                  >
                    {authStatus === "unconfigured" ? "Create Admin Password (min 8 chars)" : "Admin Password"}
                  </label>
                  <input
                    id="admin-pass"
                    type="password"
                    required
                    autoComplete={authStatus === "unconfigured" ? "new-password" : "current-password"}
                    minLength={authStatus === "unconfigured" ? 8 : 1}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter admin password"
                    className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                  />
                </div>

                {authStatus === "unconfigured" && (
                  <div>
                    <label
                      htmlFor="admin-pass-confirm"
                      className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                    >
                      Confirm Admin Password
                    </label>
                    <input
                      id="admin-pass-confirm"
                      type="password"
                      required
                      minLength={8}
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder="Re-enter admin password"
                      className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                    />
                  </div>
                )}

                {authError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#15663E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#105131] disabled:opacity-50"
                >
                  {authSubmitting
                    ? "Verifying..."
                    : authStatus === "unconfigured"
                    ? "Set Password & Open Admin"
                    : "Sign In to Admin Dashboard"}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Authenticated Admin Workspace */
          <div className="space-y-8">
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-[#DDE3D8] bg-[#F7F8F5] p-5">
                <p className="text-xs font-medium text-[#596D60]">Needs Timing Approval</p>
                <p
                  className="mt-2 text-3xl font-semibold text-[#B45309] tabular-nums"
                  style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                >
                  {metrics.awaitingApproval}
                </p>
              </div>
              <div className="rounded-xl border border-[#DDE3D8] bg-[#F7F8F5] p-5">
                <p className="text-xs font-medium text-[#596D60]">Approved · Awaiting Payment</p>
                <p
                  className="mt-2 text-3xl font-semibold text-[#0369A1] tabular-nums"
                  style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                >
                  {metrics.awaitingPayment}
                </p>
              </div>
              <div className="rounded-xl border border-[#DDE3D8] bg-[#F7F8F5] p-5">
                <p className="text-xs font-medium text-[#596D60]">Paid &amp; Booked Slots</p>
                <p
                  className="mt-2 text-3xl font-semibold text-[#15663E] tabular-nums"
                  style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                >
                  {metrics.paidBooked}
                </p>
              </div>
              <div className="rounded-xl border border-[#DDE3D8] bg-[#F7F8F5] p-5">
                <p className="text-xs font-medium text-[#596D60]">Open Slots</p>
                <p
                  className="mt-2 text-3xl font-semibold text-[#132219] tabular-nums"
                  style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                >
                  {metrics.openSlots}
                </p>
              </div>
            </div>

            {feedback && (
              <div
                className={`flex items-start gap-2.5 rounded-xl border p-4 text-sm ${
                  feedback.type === "success"
                    ? "border-[#B7DFC9] bg-[#F2FBF6] text-[#134E30]"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            {/* Segmented Navigation */}
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#EEF1EB] p-1">
              <button
                type="button"
                onClick={() => setActiveTab("bookings")}
                className={`min-h-[40px] rounded-md px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === "bookings"
                    ? "bg-[#FFFFFF] text-[#132219] shadow-xs"
                    : "text-[#4A5D51] hover:text-[#132219]"
                }`}
              >
                Booked Persons &amp; Timing Approval ({bookings.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("slots")}
                className={`min-h-[40px] rounded-md px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === "slots"
                    ? "bg-[#FFFFFF] text-[#132219] shadow-xs"
                    : "text-[#4A5D51] hover:text-[#132219]"
                }`}
              >
                Manage Slots ({slots.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("logo")}
                className={`min-h-[40px] rounded-md px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === "logo"
                    ? "bg-[#FFFFFF] text-[#132219] shadow-xs"
                    : "text-[#4A5D51] hover:text-[#132219]"
                }`}
              >
                Website Logo
              </button>
            </div>

            {/* TAB 1: BOOKED PERSONS & TIMING APPROVAL */}
            {activeTab === "bookings" && (
              <div className="rounded-2xl border border-[#DDE3D8] bg-[#F7F8F5] p-6">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <h3
                    className="text-lg font-semibold text-[#132219]"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                  >
                    People Who Booked a Slot
                  </h3>
                  <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#E7ECE3] p-1">
                    {[
                      { id: "all", label: "All" },
                      { id: "pending_approval", label: "Needs Approval" },
                      { id: "approved_awaiting_payment", label: "Awaiting Payment" },
                      { id: "confirmed", label: "Paid & Booked" },
                      { id: "completed", label: "Completed" },
                      { id: "rejected", label: "Declined" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStatusFilter(st.id)}
                        className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          statusFilter === st.id
                            ? "bg-[#FFFFFF] text-[#132219] shadow-xs"
                            : "text-[#4A5D51] hover:text-[#132219]"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredBookings.length === 0 ? (
                  <div className="rounded-xl border border-[#DDE3D8] bg-[#FFFFFF] py-12 text-center text-sm text-[#596D60]">
                    No slot bookings found for this filter.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredBookings.map((b) => {
                      const statusMeta = STATUS_LABELS[b.status] || {
                        label: b.status,
                        color: "text-[#4A5D51]",
                      };
                      return (
                        <div
                          key={b.id}
                          className="rounded-xl border border-[#DDE3D8] bg-[#FFFFFF] p-5 sm:p-6"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EAEEE7] pb-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <span
                                  className="text-sm font-semibold text-[#132219] tabular-nums"
                                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                >
                                  {b.reference_code}
                                </span>
                                <span aria-hidden="true" className="text-[#9EB5A5]">·</span>
                                <span className={`text-xs font-semibold ${statusMeta.color}`}>
                                  {statusMeta.label}
                                </span>
                              </div>
                              <h4
                                className="mt-1.5 text-lg font-semibold text-[#132219]"
                                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                              >
                                {b.client_name}
                              </h4>
                              <p className="mt-0.5 text-xs text-[#4A5D51]">
                                {b.client_phone} · {b.client_email}
                                {b.farm_location ? ` · ${b.farm_location}` : ""}
                              </p>
                            </div>

                            <div className="text-left sm:text-right">
                              <p className="text-xs font-medium text-[#596D60]">Requested Slot Timing</p>
                              <p className="mt-0.5 text-sm font-semibold text-[#132219] tabular-nums">
                                {b.slot_date}
                              </p>
                              <p
                                className="text-sm font-semibold text-[#15663E] tabular-nums"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                              >
                                {b.time_label}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-[#4A5D51] sm:grid-cols-3">
                            <div>
                              <span className="text-[#596D60]">Orchard Scope: </span>
                              <strong className="text-[#132219]">{b.acreage_tier}</strong>
                            </div>
                            <div>
                              <span className="text-[#596D60]">Booking Fee: </span>
                              <strong
                                className="text-[#132219] tabular-nums"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                              >
                                {formatInr(b.booking_fee)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[#596D60]">Payment: </span>
                              <strong className="capitalize text-[#132219]">
                                {b.payment_status === "paid"
                                  ? `Paid (${b.payment_method || "Verified"})`
                                  : b.payment_status === "unpaid"
                                  ? "Awaiting User Payment"
                                  : b.payment_status === "awaiting_approval"
                                  ? "Locked Until Admin Approves"
                                  : b.payment_status}
                              </strong>
                            </div>
                          </div>

                          {b.notes && (
                            <p className="mt-3 text-xs text-[#4A5D51]">
                              <span className="font-semibold text-[#132219]">Client Notes: </span>
                              {b.notes}
                            </p>
                          )}

                          {b.payment_reference && (
                            <p
                              className="mt-2 text-xs text-[#15663E] tabular-nums"
                              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                              Payment Receipt: {b.payment_reference}
                            </p>
                          )}

                          {/* EXPLICIT ADMIN TIMING APPROVAL PROMPT */}
                          {b.status === "pending_approval" && (
                            <div className="mt-5 rounded-xl border border-[#E5D3B3] bg-[#FFFBEB] p-4 sm:p-5">
                              <p className="text-sm font-semibold text-[#132219]">
                                Is this slot timing OK ({b.slot_date} · {b.time_label})?
                              </p>
                              <p className="mt-0.5 text-xs text-[#596D60]">
                                Approving notifies the user to pay the fee below and confirm their slot.
                                Declining immediately frees this time slot.
                              </p>

                              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
                                <div className="sm:col-span-4">
                                  <label
                                    htmlFor={`fee-${b.id}`}
                                    className="mb-1 block text-xs font-semibold text-[#2A3B31]"
                                  >
                                    Fee to Collect (INR ₹)
                                  </label>
                                  <input
                                    id={`fee-${b.id}`}
                                    type="number"
                                    min={0}
                                    max={500000}
                                    value={reviewFees[b.id] ?? String(b.booking_fee)}
                                    onChange={(e) =>
                                      setReviewFees((prev) => ({ ...prev, [b.id]: e.target.value }))
                                    }
                                    className="h-10 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3 text-sm text-[#132219] tabular-nums focus:border-[#15663E] focus:outline-none"
                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                  />
                                </div>
                                <div className="sm:col-span-8">
                                  <label
                                    htmlFor={`note-${b.id}`}
                                    className="mb-1 block text-xs font-semibold text-[#2A3B31]"
                                  >
                                    Note for Client (Optional)
                                  </label>
                                  <input
                                    id={`note-${b.id}`}
                                    type="text"
                                    placeholder="e.g. Slot timing confirmed — please complete payment to book."
                                    value={reviewNotes[b.id] ?? ""}
                                    onChange={(e) =>
                                      setReviewNotes((prev) => ({ ...prev, [b.id]: e.target.value }))
                                    }
                                    className="h-10 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3 text-sm text-[#132219] placeholder:text-[#8A998F] focus:border-[#15663E] focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-3">
                                <button
                                  type="button"
                                  disabled={reviewingId === b.id}
                                  onClick={() => handleReviewBooking(b, "approve")}
                                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#15663E] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#105131] disabled:opacity-50 whitespace-nowrap"
                                >
                                  <Check className="h-4 w-4" />
                                  Approve Timing &amp; Ask User to Pay
                                </button>
                                <button
                                  type="button"
                                  disabled={reviewingId === b.id}
                                  onClick={() => handleReviewBooking(b, "reject")}
                                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-200 bg-[#FFFFFF] px-4 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                                >
                                  <X className="h-4 w-4" />
                                  Decline Timing (Re-open Slot)
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Secondary actions for approved / paid bookings */}
                          {b.status === "approved_awaiting_payment" && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EAEEE7] pt-4">
                              <p className="text-xs font-medium text-[#0369A1]">
                                Approved — waiting for {b.client_name} to pay {formatInr(b.booking_fee)} via Check Approval &amp; Pay.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(b.id, "cancelled")}
                                className="min-h-[34px] rounded-md border border-red-200 bg-[#FFFFFF] px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Cancel &amp; Free Slot
                              </button>
                            </div>
                          )}

                          {b.status === "confirmed" && (
                            <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5 border-t border-[#EAEEE7] pt-4">
                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(b.id, "completed")}
                                className="min-h-[36px] rounded-md bg-[#15663E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#105131]"
                              >
                                Mark Session Completed
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(b.id, "cancelled")}
                                className="min-h-[36px] rounded-md border border-red-200 bg-[#FFFFFF] px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MANAGE SLOTS */}
            {activeTab === "slots" && (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <div className="rounded-2xl border border-[#DDE3D8] bg-[#F7F8F5] p-6 lg:col-span-5">
                  <h3
                    className="flex items-center gap-2 text-lg font-semibold text-[#132219]"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                  >
                    <CalendarPlus className="h-5 w-5 text-[#15663E]" />
                    Create Booking Slots
                  </h3>
                  <p className="mt-1 text-xs text-[#596D60]">
                    Add a custom time slot or generate the 4 standard daily windows in one click.
                  </p>

                  <form onSubmit={handleCreateSingleSlot} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="slot-date" className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                        Date
                      </label>
                      <input
                        id="slot-date"
                        type="date"
                        required
                        value={newSlotDate}
                        onChange={(e) => setNewSlotDate(e.target.value)}
                        className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] focus:border-[#15663E] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="slot-start" className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                          Start Time
                        </label>
                        <input
                          id="slot-start"
                          type="time"
                          required
                          value={newStartTime}
                          onChange={(e) => setNewStartTime(e.target.value)}
                          className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] focus:border-[#15663E] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="slot-end" className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                          End Time
                        </label>
                        <input
                          id="slot-end"
                          type="time"
                          required
                          value={newEndTime}
                          onChange={(e) => setNewEndTime(e.target.value)}
                          className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] focus:border-[#15663E] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="slot-type" className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                        Session Label
                      </label>
                      <input
                        id="slot-type"
                        type="text"
                        required
                        value={newSlotType}
                        onChange={(e) => setNewSlotType(e.target.value)}
                        className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] focus:border-[#15663E] focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-2.5 pt-2">
                      <button
                        type="submit"
                        disabled={creatingSlot}
                        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#15663E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#105131] disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        Add Single Time Slot
                      </button>
                      <button
                        type="button"
                        disabled={creatingSlot}
                        onClick={handleGenerateDefaultDay}
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-5 py-2.5 text-sm font-semibold text-[#132219] hover:border-[#15663E] hover:text-[#15663E] disabled:opacity-50"
                      >
                        Generate 4 Standard Slots for Selected Date
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-2xl border border-[#DDE3D8] bg-[#F7F8F5] p-6 lg:col-span-7">
                  <h3
                    className="mb-4 text-lg font-semibold text-[#132219]"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                  >
                    Published Schedule
                  </h3>
                  <div className="max-h-[520px] overflow-y-auto divide-y divide-[#DDE3D8] rounded-xl border border-[#DDE3D8] bg-[#FFFFFF] px-4">
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[#132219] tabular-nums">
                            <span>{slot.slot_date}</span>
                            <span aria-hidden="true">·</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                              {slot.time_label}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-[#596D60]">
                            <span>{slot.slot_type}</span>
                            {slot.client_name && (
                              <span> · Requested by {slot.client_name} ({slot.reference_code})</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span
                            className={`text-xs font-semibold capitalize ${
                              slot.status === "open"
                                ? "text-[#15663E]"
                                : slot.status === "booked"
                                ? "text-[#B45309]"
                                : "text-[#64748B]"
                            }`}
                          >
                            {slot.status}
                          </span>

                          {slot.status !== "booked" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleSlotBlock(slot)}
                                className="min-h-[34px] rounded-md border border-[#C9D3C3] bg-[#FFFFFF] px-3 py-1 text-xs font-medium text-[#132219] hover:border-[#15663E]"
                              >
                                {slot.status === "blocked" ? "Re-open" : "Block"}
                              </button>
                              <button
                                type="button"
                                aria-label="Delete slot"
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: WEBSITE LOGO */}
            {activeTab === "logo" && (
              <div className="max-w-2xl rounded-2xl border border-[#DDE3D8] bg-[#F7F8F5] p-6 sm:p-8">
                <h3
                  className="flex items-center gap-2 text-lg font-semibold text-[#132219]"
                  style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                >
                  <ImageIcon className="h-5 w-5 text-[#15663E]" />
                  Website Logo Image
                </h3>
                <p className="mt-1 text-sm text-[#4A5D51]">
                  Upload a replacement main website logo (PNG, JPG, or WebP, max 2 MB). The V2V logo
                  remains in the top-left corner.
                </p>

                <div className="mt-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                  <div className="flex h-28 w-64 items-center justify-center rounded-xl border border-[#DDE3D8] bg-[#FFFFFF] p-4">
                    <img
                      src={logoUrl || "/assets/aistudio/IMG-20261123-WA0000_a37a8dc6.jpg"}
                      alt="Current Website Logo"
                      referrerPolicy="no-referrer"
                      className="max-h-20 max-w-full object-contain"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#15663E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#105131]">
                      <Upload className="h-4 w-4" />
                      {logoUploading ? "Uploading..." : "Upload New Logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoFileChange}
                        disabled={logoUploading}
                        className="sr-only"
                      />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleResetLogo}
                        disabled={logoUploading}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-4 py-2 text-xs font-semibold text-[#2A3B31] hover:border-[#15663E]"
                      >
                        Reset to Default Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
