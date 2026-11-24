import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { HeroLogoSection } from "./components/HeroLogoSection";
import { OurWorkSection } from "./components/OurWorkSection";
import { BookingSlotSection } from "./components/BookingSlotSection";
import { AdminBookingPanel } from "./components/AdminBookingPanel";
import { BrainsBehindMission } from "./components/BrainsBehindMission";
import { ContactSection } from "./components/ContactSection";
import { solarHarvestApi } from "./lib/solarharvestApi";

interface SolarHarvestAppProps {
  initialView?: "client" | "admin";
}

export default function SolarHarvestApp({ initialView = "client" }: SolarHarvestAppProps) {
  const [activeView, setActiveView] = useState<"client" | "admin">(initialView);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [bookingPanelOpen, setBookingPanelOpen] = useState<boolean>(true);
  const [selectedAcreageTier, setSelectedAcreageTier] = useState<string>("1 Acre Guava Field");
  // Admin Bearer token is kept strictly in React memory (never persisted in localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState<number>(0);

  useEffect(() => {
    solarHarvestApi
      .getSettings()
      .then((settings) => {
        if (settings?.logoUrl) {
          setLogoUrl(settings.logoUrl);
        }
      })
      .catch(() => {
        // Fallback to default logo cleanly
      });
  }, []);

  const scrollToSection = (sectionId?: string) => {
    if (!sectionId || sectionId === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = document.getElementById(sectionId);
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const handleNavigateClient = (sectionId?: string) => {
    if (activeView !== "client") {
      setActiveView("client");
      setTimeout(() => scrollToSection(sectionId), 60);
    } else {
      scrollToSection(sectionId);
    }
  };

  const handleBookSlotClick = () => {
    setBookingPanelOpen(true);
    handleNavigateClient("booking-slot");
  };

  const handleSelectAcreageAndBook = (acreageTier: string) => {
    setSelectedAcreageTier(acreageTier);
    setBookingPanelOpen(true);
    handleNavigateClient("booking-slot");
  };

  return (
    <div
      className="min-h-screen bg-[#F7F8F5] text-[#132219] antialiased selection:bg-[#15663E]/15 selection:text-[#132219]"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <Header
        logoUrl={logoUrl}
        onBookSlotClick={handleBookSlotClick}
        activeView={activeView}
        onNavigateClient={handleNavigateClient}
      />

      {activeView === "admin" ? (
        <main>
          <AdminBookingPanel
            standalone
            adminToken={adminToken}
            onAuthChange={setAdminToken}
            logoUrl={logoUrl}
            onLogoChange={setLogoUrl}
            onBackToClient={() => handleNavigateClient("top")}
            onSlotsMutated={() => setRefreshSignal((prev) => prev + 1)}
            refreshSignal={refreshSignal}
          />
        </main>
      ) : (
        <main>
          {/* 1. Website Logo & Hero */}
          <HeroLogoSection
            logoUrl={logoUrl}
            onBookSlotClick={handleBookSlotClick}
            onExploreWorkClick={() => scrollToSection("our-work")}
          />

          {/* 2. OUR WORK (1 Acre & 3 Acre Guava Field Deployments) */}
          <OurWorkSection onSelectAcreageAndBook={handleSelectAcreageAndBook} />

          {/* 3. Book a Slot Button + Client Slot Request & Post-Approval Payment */}
          <BookingSlotSection
            selectedAcreageTier={selectedAcreageTier}
            onAcreageTierChange={setSelectedAcreageTier}
            bookingPanelOpen={bookingPanelOpen}
            onToggleBookingPanel={setBookingPanelOpen}
            refreshSignal={refreshSignal}
            onBookingCreated={() => setRefreshSignal((prev) => prev + 1)}
          />

          {/* 4. Brains Behind the Mission (Extracted from previous application) */}
          <BrainsBehindMission />

          {/* 5. Contact (Extracted from previous application) */}
          <ContactSection />

          {/* 6. Admin Login at Last — Review Booked Persons, Approve Timing, Unlock User Payment */}
          <AdminBookingPanel
            adminToken={adminToken}
            onAuthChange={setAdminToken}
            logoUrl={logoUrl}
            onLogoChange={setLogoUrl}
            onSlotsMutated={() => setRefreshSignal((prev) => prev + 1)}
            refreshSignal={refreshSignal}
          />
        </main>
      )}

      {/* Quiet Footer */}
      <footer className="border-t border-[#DDE3D8] bg-[#F7F8F5] py-8">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-5 text-xs text-[#596D60] sm:flex-row sm:px-8">
          <p>© {new Date().getFullYear()} SolarHarvest · Vision2Value Technologies</p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => handleNavigateClient("our-work")}
              className="hover:text-[#132219] transition-colors"
            >
              Our Work
            </button>
            <button
              type="button"
              onClick={() => handleNavigateClient("booking-slot")}
              className="hover:text-[#132219] transition-colors"
            >
              Book Slot
            </button>
            <button
              type="button"
              onClick={() => handleNavigateClient("contact")}
              className="hover:text-[#132219] transition-colors"
            >
              Contact
            </button>
            <button
              type="button"
              onClick={() => handleNavigateClient("admin-login")}
              className="hover:text-[#132219] transition-colors"
            >
              Admin Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
