import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  solarHarvestApi,
  type BookingConfirmation,
  type BookingRecord,
  type BookingSlot,
} from "../lib/solarharvestApi";

interface BookingSlotSectionProps {
  selectedAcreageTier: string;
  onAcreageTierChange: (tier: string) => void;
  bookingPanelOpen: boolean;
  onToggleBookingPanel: (open: boolean) => void;
  refreshSignal: number;
  onBookingCreated?: () => void;
}

const ACREAGE_OPTIONS = [
  { label: "1 Acre Guava Field", fee: 1500 },
  { label: "3 Acre Guava Field", fee: 3000 },
  { label: "Custom Guava / Orchard Acreage", fee: 2500 },
  { label: "Energy Saving Trust M&E Briefing", fee: 1000 },
];

const formatInr = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatReadableDate = (isoDate: string): { weekday: string; dayMonth: string; full: string } => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  return {
    weekday: dateObj.toLocaleDateString("en-IN", { weekday: "short" }),
    dayMonth: dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    full: dateObj.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
};

const getStatusSummary = (status: BookingRecord["status"]) => {
  switch (status) {
    case "pending_approval":
      return {
        label: "Waiting for Admin Timing Approval",
        tone: "text-[#B45309]",
      };
    case "approved_awaiting_payment":
      return {
        label: "Timing Approved — Payment Required to Book Slot",
        tone: "text-[#15663E]",
      };
    case "confirmed":
      return {
        label: "Paid & Slot Officially Booked",
        tone: "text-[#15663E]",
      };
    case "completed":
      return {
        label: "Session Completed",
        tone: "text-[#1D4ED8]",
      };
    case "rejected":
      return {
        label: "Timing Declined — Please Pick Another Slot",
        tone: "text-[#B91C1C]",
      };
    default:
      return {
        label: "Cancelled",
        tone: "text-[#64748B]",
      };
  }
};

export function BookingSlotSection({
  selectedAcreageTier,
  onAcreageTierChange,
  bookingPanelOpen,
  onToggleBookingPanel,
  refreshSignal,
  onBookingCreated,
}: BookingSlotSectionProps) {
  const [activeTab, setActiveTab] = useState<"book" | "lookup">("book");
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  // Lookup & Payment state
  const [lookupRef, setLookupRef] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupResult, setLookupResult] = useState<BookingRecord | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Card" | "Net Banking">("UPI");
  const [payerDetail, setPayerDetail] = useState("");
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState("");

  const loadSlots = async () => {
    setLoadingSlots(true);
    setSlotsError("");
    try {
      const data = await solarHarvestApi.getPublicSlots();
      setSlots(data);
      const uniqueDates = Array.from(new Set(data.map((s) => s.slot_date)));
      if (uniqueDates.length > 0) {
        setSelectedDate((prev) => (prev && uniqueDates.includes(prev) ? prev : uniqueDates[0]));
      }
    } catch (err: any) {
      setSlotsError(err?.message || "Unable to load available booking slots.");
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, [refreshSignal]);

  // If user is currently viewing a booking in lookup tab and admin approves it in the same page, refresh it automatically
  useEffect(() => {
    if (lookupResult && lookupRef && lookupEmail) {
      solarHarvestApi
        .lookupBooking(lookupRef, lookupEmail)
        .then((fresh) => setLookupResult(fresh))
        .catch(() => {});
    }
  }, [refreshSignal]);

  const datesSummary = useMemo(() => {
    const map = new Map<string, { total: number; open: number }>();
    for (const s of slots) {
      const entry = map.get(s.slot_date) || { total: 0, open: 0 };
      entry.total += 1;
      if (s.status === "open") entry.open += 1;
      map.set(s.slot_date, entry);
    }
    return Array.from(map.entries()).map(([date, counts]) => ({
      date,
      ...counts,
      formatted: formatReadableDate(date),
    }));
  }, [slots]);

  const slotsForSelectedDate = useMemo(
    () => slots.filter((s) => s.slot_date === selectedDate),
    [slots, selectedDate]
  );

  const selectedSlotObj = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) || null,
    [slots, selectedSlotId]
  );

  const totalOpenSlots = useMemo(
    () => slots.filter((s) => s.status === "open").length,
    [slots]
  );

  const selectedTierInfo = useMemo(
    () => ACREAGE_OPTIONS.find((o) => o.label === selectedAcreageTier) || ACREAGE_OPTIONS[0],
    [selectedAcreageTier]
  );

  const fetchLookup = async (ref: string, email: string) => {
    setLookupLoading(true);
    setLookupError("");
    setPaymentError("");
    setPaymentSuccessMsg("");
    try {
      const record = await solarHarvestApi.lookupBooking(ref, email);
      setLookupResult(record);
    } catch (err: any) {
      setLookupResult(null);
      setLookupError(err?.message || "Booking not found.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) {
      setSubmitError("Please choose an available date and time slot first.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await solarHarvestApi.createBooking({
        slotId: selectedSlotId,
        clientName,
        clientEmail,
        clientPhone,
        acreageTier: selectedAcreageTier,
        farmLocation,
        notes,
      });
      setConfirmation(result);
      setLookupRef(result.referenceCode);
      setLookupEmail(result.clientEmail);
      setSelectedSlotId(null);
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setFarmLocation("");
      setNotes("");
      await loadSlots();
      onBookingCreated?.();
    } catch (err: any) {
      setSubmitError(err?.message || "Could not submit your slot request. Please try again.");
      await loadSlots();
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchLookup(lookupRef, lookupEmail);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupResult) return;

    setPaying(true);
    setPaymentError("");
    setPaymentSuccessMsg("");
    try {
      const paidRecord = await solarHarvestApi.payForApprovedBooking({
        referenceCode: lookupResult.reference_code,
        email: lookupResult.client_email,
        paymentMethod,
        payerDetail,
      });
      setLookupResult(paidRecord);
      setPayerDetail("");
      setPaymentSuccessMsg("Payment received! Your slot is now officially booked.");
      onBookingCreated?.();
    } catch (err: any) {
      setPaymentError(err?.message || "Payment failed. Please verify details and try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <section id="booking-slot" className="border-b border-[#DDE3D8] bg-[#F7F8F5] py-20 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="rounded-2xl border border-[#DDE3D8] bg-[#FFFFFF] p-8 sm:p-10">
          {/* Header CTA Banner (Client-focused — Admin Login is at the bottom of the page) */}
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-wide text-[#15663E]">
                Client Slot Booking · 3-Step Approval &amp; Payment Flow
              </p>
              <h2
                className="mt-2 text-3xl font-semibold tracking-tight text-[#132219] sm:text-4xl"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  textWrap: "balance",
                }}
              >
                Book Your SolarHarvest Field Consultation Slot
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[#4A5D51]">
                Select your preferred date and time slot first. Once our admin approves that your
                requested timing is available, you will be prompted to complete payment to finalize
                your slot booking.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#596D60] tabular-nums">
                <span>1. Request Slot Timing</span>
                <span aria-hidden="true">·</span>
                <span>2. Admin Approves Timing</span>
                <span aria-hidden="true">·</span>
                <span>3. Pay &amp; Confirm Booking</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#15663E]">{totalOpenSlots} open slots available</span>
              </div>
            </div>

            <div className="flex shrink-0">
              <button
                type="button"
                onClick={() => onToggleBookingPanel(!bookingPanelOpen)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[#15663E] px-7 py-3 text-base font-semibold text-white transition-colors duration-150 hover:bg-[#105131] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15663E] focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
              >
                <CalendarDays className="h-4 w-4" />
                {bookingPanelOpen ? "Hide Booking Panel" : "Book a Slot"}
              </button>
            </div>
          </div>

          {/* Interactive Client Booking & Payment Panel */}
          {bookingPanelOpen && (
            <div className="mt-10 border-t border-[#EAEEE7] pt-8">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div className="inline-flex items-center gap-1 rounded-lg bg-[#EEF1EB] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("book");
                      setConfirmation(null);
                    }}
                    className={`min-h-[38px] rounded-md px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                      activeTab === "book"
                        ? "bg-[#FFFFFF] text-[#132219] shadow-xs"
                        : "text-[#4A5D51] hover:text-[#132219]"
                    }`}
                  >
                    Request a Slot
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("lookup")}
                    className={`min-h-[38px] rounded-md px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                      activeTab === "lookup"
                        ? "bg-[#FFFFFF] text-[#132219] shadow-xs"
                        : "text-[#4A5D51] hover:text-[#132219]"
                    }`}
                  >
                    Check Approval &amp; Pay
                  </button>
                </div>

                {activeTab === "book" && (
                  <button
                    type="button"
                    onClick={loadSlots}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#DDE3D8] bg-[#FFFFFF] px-3.5 py-1.5 text-xs font-medium text-[#4A5D51] transition-colors hover:border-[#15663E] hover:text-[#15663E] whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingSlots ? "animate-spin" : ""}`} />
                    Refresh Slots
                  </button>
                )}
              </div>

              {activeTab === "book" ? (
                confirmation ? (
                  <div className="rounded-xl border border-[#E5D3B3] bg-[#FFFBEB] p-6 sm:p-8">
                    <div className="flex items-start gap-4">
                      <Clock className="mt-0.5 h-6 w-6 shrink-0 text-[#B45309]" />
                      <div className="flex-1">
                        <h3
                          className="text-xl font-semibold text-[#132219]"
                          style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                          Step 1 Complete — Waiting for Admin Approval on Slot Timing
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-[#4A5D51]">
                          Thank you, <strong className="text-[#132219]">{confirmation.clientName}</strong>. Your
                          slot request has been sent to the Admin to verify whether this timing is OK.
                          Once approved, return to <strong className="text-[#132219]">Check Approval &amp; Pay</strong> using
                          your reference code below to complete payment and finalize your booking.
                        </p>

                        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-[#F0DFC1] pt-5 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <dt className="text-xs text-[#596D60]">Reference Code</dt>
                            <dd
                              className="mt-1 text-base font-semibold text-[#132219] tabular-nums"
                              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                              {confirmation.referenceCode}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-[#596D60]">Requested Date</dt>
                            <dd className="mt-1 text-sm font-semibold text-[#132219]">
                              {formatReadableDate(confirmation.slotDate).full}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-[#596D60]">Requested Timing</dt>
                            <dd
                              className="mt-1 text-sm font-semibold text-[#132219] tabular-nums"
                              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                              {confirmation.timeLabel}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-[#596D60]">Fee Payable After Approval</dt>
                            <dd
                              className="mt-1 text-sm font-semibold text-[#132219] tabular-nums"
                              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                              {formatInr(confirmation.bookingFee)}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-6 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={async () => {
                              setConfirmation(null);
                              setActiveTab("lookup");
                              await fetchLookup(confirmation.referenceCode, confirmation.clientEmail);
                            }}
                            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#15663E] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#105131] whitespace-nowrap shrink-0"
                          >
                            <CreditCard className="h-4 w-4" />
                            Check Approval &amp; Proceed to Payment
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmation(null)}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-5 py-2 text-sm font-medium text-[#132219] transition-colors hover:border-[#15663E] whitespace-nowrap shrink-0"
                          >
                            Request Another Slot
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                    {/* Left Column: Date & Time Slot Selector */}
                    <div className="lg:col-span-6">
                      <h3
                        className="text-lg font-semibold text-[#132219]"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                      >
                        1. Choose Preferred Date &amp; Time Slot
                      </h3>

                      {slotsError && (
                        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{slotsError}</span>
                        </div>
                      )}

                      {loadingSlots ? (
                        <div className="mt-4 rounded-xl border border-[#EAEEE7] bg-[#F7F8F5] p-8 text-center text-sm text-[#596D60]">
                          Loading live booking slots...
                        </div>
                      ) : datesSummary.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-[#EAEEE7] bg-[#F7F8F5] p-8 text-center text-sm text-[#596D60]">
                          No upcoming slots are open right now. Please check back shortly.
                        </div>
                      ) : (
                        <>
                          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                            {datesSummary.map((item) => {
                              const isSelected = item.date === selectedDate;
                              const soldOut = item.open === 0;
                              return (
                                <button
                                  key={item.date}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDate(item.date);
                                    setSelectedSlotId(null);
                                  }}
                                  className={`flex min-h-[72px] flex-col items-start justify-between rounded-xl border p-3 text-left transition-colors ${
                                    isSelected
                                      ? "border-[#15663E] bg-[#EEF7F2] text-[#132219]"
                                      : "border-[#DDE3D8] bg-[#FFFFFF] text-[#2A3B31] hover:border-[#9EB5A5]"
                                  }`}
                                >
                                  <span className="text-xs font-medium text-[#596D60]">
                                    {item.formatted.weekday}
                                  </span>
                                  <span className="text-sm font-semibold text-[#132219] tabular-nums">
                                    {item.formatted.dayMonth}
                                  </span>
                                  <span
                                    className={`text-[11px] font-medium tabular-nums ${
                                      soldOut ? "text-[#9A3412]" : "text-[#15663E]"
                                    }`}
                                  >
                                    {soldOut ? "Full" : `${item.open} open`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-6">
                            <p className="mb-3 text-xs font-medium text-[#596D60]">
                              Slots for{" "}
                              <span className="font-semibold text-[#132219]">
                                {selectedDate ? formatReadableDate(selectedDate).full : ""}
                              </span>
                            </p>
                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                              {slotsForSelectedDate.map((slot) => {
                                const isOpen = slot.status === "open";
                                const isSelected = selectedSlotId === slot.id;
                                return (
                                  <button
                                    key={slot.id}
                                    type="button"
                                    disabled={!isOpen}
                                    onClick={() => setSelectedSlotId(slot.id)}
                                    className={`flex min-h-[62px] flex-col items-start justify-center rounded-xl border px-4 py-3 text-left transition-colors ${
                                      !isOpen
                                        ? "cursor-not-allowed border-[#E5E9E2] bg-[#F4F6F2] text-[#8A998F]"
                                        : isSelected
                                        ? "border-[#15663E] bg-[#15663E] text-white"
                                        : "border-[#DDE3D8] bg-[#FFFFFF] text-[#132219] hover:border-[#15663E]"
                                    }`}
                                  >
                                    <div className="flex w-full items-center justify-between gap-2">
                                      <span
                                        className="flex items-center gap-1.5 text-sm font-semibold tabular-nums whitespace-nowrap"
                                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                      >
                                        {isOpen ? (
                                          <Clock className="h-3.5 w-3.5 shrink-0" />
                                        ) : (
                                          <Lock className="h-3.5 w-3.5 shrink-0" />
                                        )}
                                        {slot.time_label}
                                      </span>
                                      <span
                                        className={`text-xs font-medium whitespace-nowrap ${
                                          !isOpen
                                            ? "text-[#8A998F]"
                                            : isSelected
                                            ? "text-white/90"
                                            : "text-[#15663E]"
                                        }`}
                                      >
                                        {slot.status === "open"
                                          ? isSelected
                                            ? "Selected"
                                            : "Open"
                                          : slot.status === "booked"
                                          ? "Booked"
                                          : "Blocked"}
                                      </span>
                                    </div>
                                    <span
                                      className={`mt-1 text-xs ${
                                        isSelected ? "text-white/80" : "text-[#596D60]"
                                      }`}
                                    >
                                      {slot.slot_type}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Right Column: Client Details Form */}
                    <div className="lg:col-span-6 lg:border-l lg:border-[#EAEEE7] lg:pl-10">
                      <h3
                        className="text-lg font-semibold text-[#132219]"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                      >
                        2. Enter Client &amp; Orchard Details
                      </h3>

                      <div className="mt-3 rounded-lg bg-[#F7F8F5] px-4 py-3 text-xs text-[#4A5D51]">
                        {selectedSlotObj ? (
                          <span>
                            Selected Slot:{" "}
                            <strong className="text-[#132219]">
                              {formatReadableDate(selectedSlotObj.slot_date).dayMonth} ·{" "}
                              <span
                                className="tabular-nums"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                              >
                                {selectedSlotObj.time_label}
                              </span>
                            </strong>{" "}
                            · Fee after admin approval:{" "}
                            <strong className="text-[#15663E] tabular-nums">
                              {formatInr(selectedTierInfo.fee)}
                            </strong>
                          </span>
                        ) : (
                          <span>
                            Select an open time slot on the left. No payment is taken until Admin
                            approves the slot timing.
                          </span>
                        )}
                      </div>

                      <form onSubmit={handleBookingSubmit} className="mt-5 space-y-4">
                        <div>
                          <label
                            htmlFor="sh-acreage"
                            className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                          >
                            Guava Field / Deployment Scope
                          </label>
                          <select
                            id="sh-acreage"
                            value={selectedAcreageTier}
                            onChange={(e) => onAcreageTierChange(e.target.value)}
                            className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                          >
                            {ACREAGE_OPTIONS.map((opt) => (
                              <option key={opt.label} value={opt.label}>
                                {opt.label} ({formatInr(opt.fee)} after approval)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor="sh-client-name"
                              className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                            >
                              Full Name *
                            </label>
                            <input
                              id="sh-client-name"
                              type="text"
                              required
                              placeholder="e.g. Karthik Sundaram"
                              value={clientName}
                              onChange={(e) => setClientName(e.target.value)}
                              className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] placeholder:text-[#8A998F] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="sh-client-phone"
                              className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                            >
                              Phone Number *
                            </label>
                            <input
                              id="sh-client-phone"
                              type="tel"
                              required
                              placeholder="+91 98765 43210"
                              value={clientPhone}
                              onChange={(e) => setClientPhone(e.target.value)}
                              className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] placeholder:text-[#8A998F] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor="sh-client-email"
                              className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                            >
                              Email Address *
                            </label>
                            <input
                              id="sh-client-email"
                              type="email"
                              required
                              placeholder="name@example.com"
                              value={clientEmail}
                              onChange={(e) => setClientEmail(e.target.value)}
                              className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] placeholder:text-[#8A998F] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="sh-farm-location"
                              className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                            >
                              Orchard Location
                            </label>
                            <input
                              id="sh-farm-location"
                              type="text"
                              placeholder="District / Town, Tamil Nadu"
                              value={farmLocation}
                              onChange={(e) => setFarmLocation(e.target.value)}
                              className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] placeholder:text-[#8A998F] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="sh-notes"
                            className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                          >
                            Requirements / Notes
                          </label>
                          <textarea
                            id="sh-notes"
                            rows={3}
                            placeholder="Share existing borewell/drip setup, solar requirements, or pest monitoring goals..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#132219] placeholder:text-[#8A998F] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                          />
                        </div>

                        {submitError && (
                          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{submitError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={submitting || !selectedSlotId}
                          className="inline-flex min-h-[46px] w-full items-center justify-center rounded-lg bg-[#15663E] px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#105131] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {submitting ? "Submitting Request..." : "Request Slot Timing for Admin Approval"}
                        </button>
                      </form>
                    </div>
                  </div>
                )
              ) : (
                /* Lookup Approval Status & Complete Payment Tab */
                <div className="max-w-3xl">
                  <h3
                    className="text-lg font-semibold text-[#132219]"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                  >
                    Check Admin Approval &amp; Pay to Book Your Slot
                  </h3>
                  <p className="mt-1 text-sm text-[#4A5D51]">
                    Enter your booking reference code and email. Once Admin approves your slot
                    timing, the payment checkout unlocks right here.
                  </p>

                  <form
                    onSubmit={handleLookupSubmit}
                    className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-end"
                  >
                    <div className="sm:col-span-4">
                      <label
                        htmlFor="lookup-ref"
                        className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                      >
                        Reference Code *
                      </label>
                      <input
                        id="lookup-ref"
                        type="text"
                        required
                        placeholder="SH-2026-XXXXXX"
                        value={lookupRef}
                        onChange={(e) => setLookupRef(e.target.value)}
                        className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label
                        htmlFor="lookup-email"
                        className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                      >
                        Email Address *
                      </label>
                      <input
                        id="lookup-email"
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={lookupEmail}
                        onChange={(e) => setLookupEmail(e.target.value)}
                        className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        disabled={lookupLoading}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#15663E] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#105131] disabled:opacity-50 whitespace-nowrap"
                      >
                        <Search className="h-4 w-4" />
                        {lookupLoading ? "Checking..." : "Check Status"}
                      </button>
                    </div>
                  </form>

                  {lookupError && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{lookupError}</span>
                    </div>
                  )}

                  {lookupResult && (
                    <div className="mt-6 rounded-xl border border-[#DDE3D8] bg-[#F7F8F5] p-6">
                      {/* Header status line */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DDE3D8] pb-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="text-base font-semibold text-[#132219] tabular-nums"
                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                          >
                            {lookupResult.reference_code}
                          </span>
                          <span aria-hidden="true" className="text-[#9EB5A5]">·</span>
                          <span className={`text-sm font-semibold ${getStatusSummary(lookupResult.status).tone}`}>
                            {getStatusSummary(lookupResult.status).label}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => fetchLookup(lookupResult.reference_code, lookupResult.client_email)}
                          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#C9D3C3] bg-[#FFFFFF] px-3 py-1 text-xs font-medium text-[#2A3B31] hover:border-[#15663E]"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${lookupLoading ? "animate-spin" : ""}`} />
                          Refresh
                        </button>
                      </div>

                      {/* Details Grid */}
                      <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <dt className="text-xs text-[#596D60]">Client</dt>
                          <dd className="mt-0.5 font-medium text-[#132219]">{lookupResult.client_name}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#596D60]">Guava Field Scope</dt>
                          <dd className="mt-0.5 font-medium text-[#132219]">{lookupResult.acreage_tier}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#596D60]">Slot Date</dt>
                          <dd className="mt-0.5 font-medium text-[#132219]">
                            {formatReadableDate(lookupResult.slot_date).full}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#596D60]">Time Window</dt>
                          <dd
                            className="mt-0.5 font-medium text-[#132219] tabular-nums"
                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                          >
                            {lookupResult.time_label}
                          </dd>
                        </div>
                      </dl>

                      {lookupResult.admin_note && (
                        <div className="mt-4 rounded-lg border border-[#DDE3D8] bg-[#FFFFFF] px-4 py-3 text-xs text-[#3E5045]">
                          <span className="font-semibold text-[#132219]">Admin Note: </span>
                          {lookupResult.admin_note}
                        </div>
                      )}

                      {/* Stage-specific Next Action */}
                      {lookupResult.status === "pending_approval" && (
                        <div className="mt-5 rounded-xl border border-[#E5D3B3] bg-[#FFFBEB] p-4 text-sm text-[#78350F]">
                          <p className="font-semibold">Awaiting Admin Timing Review</p>
                          <p className="mt-1 text-xs leading-relaxed">
                            Our admin team is checking whether your requested slot timing is available.
                            Payment is locked until the admin approves. Check back here or click Refresh
                            after admin approval.
                          </p>
                        </div>
                      )}

                      {lookupResult.status === "rejected" && (
                        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                          <p className="font-semibold">Slot Timing Unavailable</p>
                          <p className="mt-1 text-xs">
                            Please choose another open date or time slot under the Request a Slot tab.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab("book")}
                            className="mt-3 inline-flex min-h-[38px] items-center rounded-lg bg-[#15663E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#105131]"
                          >
                            Pick Another Open Slot
                          </button>
                        </div>
                      )}

                      {/* STEP 3: PAYMENT CHECKOUT — UNLOCKED ONLY AFTER ADMIN APPROVAL */}
                      {lookupResult.status === "approved_awaiting_payment" && (
                        <div className="mt-6 rounded-xl border border-[#B7DFC9] bg-[#FFFFFF] p-6">
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EAEEE7] pb-4">
                            <div>
                              <p className="text-xs font-semibold text-[#15663E]">
                                Admin Approved Your Slot Timing
                              </p>
                              <h4
                                className="mt-1 text-lg font-semibold text-[#132219]"
                                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                              >
                                Complete Payment to Finalize Your Booking
                              </h4>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-[#596D60]">Amount Payable</p>
                              <p
                                className="text-2xl font-bold text-[#132219] tabular-nums"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                              >
                                {formatInr(lookupResult.booking_fee)}
                              </p>
                            </div>
                          </div>

                          <form onSubmit={handlePaymentSubmit} className="mt-5 space-y-4">
                            <div>
                              <span className="mb-2 block text-xs font-semibold text-[#2A3B31]">
                                Select Payment Method
                              </span>
                              <div className="grid grid-cols-3 gap-2.5">
                                {(["UPI", "Card", "Net Banking"] as const).map((method) => (
                                  <button
                                    key={method}
                                    type="button"
                                    onClick={() => setPaymentMethod(method)}
                                    className={`min-h-[42px] rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                                      paymentMethod === method
                                        ? "border-[#15663E] bg-[#EEF7F2] text-[#15663E]"
                                        : "border-[#C9D3C3] bg-[#FFFFFF] text-[#2A3B31] hover:border-[#15663E]"
                                    }`}
                                  >
                                    {method}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label
                                htmlFor="payer-detail"
                                className="mb-1.5 block text-xs font-semibold text-[#2A3B31]"
                              >
                                {paymentMethod === "UPI"
                                  ? "UPI ID or UTR Reference *"
                                  : paymentMethod === "Card"
                                  ? "Cardholder Name *"
                                  : "Bank Name / Transfer Reference *"}
                              </label>
                              <input
                                id="payer-detail"
                                type="text"
                                required
                                value={payerDetail}
                                onChange={(e) => setPayerDetail(e.target.value)}
                                placeholder={
                                  paymentMethod === "UPI"
                                    ? "e.g. yourname@okaxis or UTR123456789"
                                    : paymentMethod === "Card"
                                    ? "Name on card"
                                    : "e.g. SBI / IMPS Ref #..."
                                }
                                className="h-11 w-full rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-3.5 text-sm text-[#132219] placeholder:text-[#8A998F] focus:border-[#15663E] focus:outline-none focus:ring-2 focus:ring-[#15663E]/20"
                              />
                            </div>

                            {paymentError && (
                              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{paymentError}</span>
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={paying}
                              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-[#15663E] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#105131] disabled:opacity-50"
                            >
                              <CreditCard className="h-4 w-4" />
                              {paying
                                ? "Processing Payment..."
                                : `Pay ${formatInr(lookupResult.booking_fee)} & Book Slot`}
                            </button>
                          </form>
                        </div>
                      )}

                      {/* PAID & CONFIRMED RECEIPT */}
                      {(lookupResult.status === "confirmed" || lookupResult.status === "completed") && (
                        <div className="mt-5 rounded-xl border border-[#B7DFC9] bg-[#F2FBF6] p-5">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#15663E]" />
                            <div className="flex-1 text-sm text-[#134E30]">
                              <p className="font-semibold">
                                {paymentSuccessMsg || "Payment Confirmed — Your Slot Is Officially Booked"}
                              </p>
                              <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                                <div>
                                  <span className="text-[#4A5D51]">Amount Paid: </span>
                                  <strong
                                    className="tabular-nums text-[#132219]"
                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                  >
                                    {formatInr(lookupResult.booking_fee)}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-[#4A5D51]">Method: </span>
                                  <strong className="text-[#132219]">
                                    {lookupResult.payment_method || "Verified"}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-[#4A5D51]">Receipt: </span>
                                  <strong
                                    className="text-[#132219]"
                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                  >
                                    {lookupResult.payment_reference || "Confirmed"}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
