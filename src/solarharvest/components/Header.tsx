import { useState } from "react";
import { Menu, X } from "lucide-react";

interface HeaderProps {
  logoUrl: string;
  onBookSlotClick: () => void;
  activeView: "client" | "admin";
  onNavigateClient: (sectionId?: string) => void;
}

export function Header({
  logoUrl,
  onBookSlotClick,
  activeView,
  onNavigateClient,
}: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (sectionId: string) => {
    setMobileOpen(false);
    onNavigateClient(sectionId);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#DDE3D8] bg-[#F7F8F5]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-8 px-5 sm:px-8">
        {/* Zone 1: V2V Logo in Top-Left Corner + Single-line Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigateClient("top");
          }}
          className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[#132219] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15663E] rounded-md"
          style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
        >
          <img
            src="/v2v-logo.png"
            alt="V2V Tech"
            referrerPolicy="no-referrer"
            className="h-10 w-auto object-contain shrink-0"
          />
          <span>SolarHarvest</span>
        </a>

        {/* Zone 2: 4 Clean Single-Line Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4A5D51]"
        >
          <a
            href="#our-work"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("our-work");
            }}
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#132219] hover:underline underline-offset-4"
          >
            Our Work
          </a>
          <a
            href="#booking-slot"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("booking-slot");
            }}
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#132219] hover:underline underline-offset-4"
          >
            Book Slot
          </a>
          <a
            href="#brains-behind-mission"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("brains-behind-mission");
            }}
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#132219] hover:underline underline-offset-4"
          >
            Our Team
          </a>
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("contact");
            }}
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#132219] hover:underline underline-offset-4"
          >
            Contact
          </a>
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              if (activeView === "admin") {
                onNavigateClient("booking-slot");
              } else {
                onBookSlotClick();
              }
            }}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#15663E] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#105131] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15663E] focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
          >
            {activeView === "admin" ? "Client View" : "Book a Slot"}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#DDE3D8] text-[#132219] md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="border-t border-[#DDE3D8] bg-[#FFFFFF] px-5 py-4 md:hidden"
        >
          <div className="flex flex-col gap-2 text-sm font-medium text-[#2A3B31]">
            <button
              type="button"
              onClick={() => handleNavClick("our-work")}
              className="min-h-[44px] rounded-md px-3 text-left hover:bg-[#EEF1EB]"
            >
              Our Work
            </button>
            <button
              type="button"
              onClick={() => handleNavClick("booking-slot")}
              className="min-h-[44px] rounded-md px-3 text-left hover:bg-[#EEF1EB]"
            >
              Book Slot
            </button>
            <button
              type="button"
              onClick={() => handleNavClick("brains-behind-mission")}
              className="min-h-[44px] rounded-md px-3 text-left hover:bg-[#EEF1EB]"
            >
              Our Team
            </button>
            <button
              type="button"
              onClick={() => handleNavClick("contact")}
              className="min-h-[44px] rounded-md px-3 text-left hover:bg-[#EEF1EB]"
            >
              Contact
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
