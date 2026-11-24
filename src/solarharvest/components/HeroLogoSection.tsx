import { useState } from "react";
import { ArrowDown, CalendarDays, Sun } from "lucide-react";

interface HeroLogoSectionProps {
  logoUrl: string;
  onBookSlotClick: () => void;
  onExploreWorkClick: () => void;
}

const DEFAULT_MAIN_LOGO = "/assets/aistudio/IMG-20261123-WA0000_a37a8dc6.jpg";

export function HeroLogoSection({
  logoUrl,
  onBookSlotClick,
  onExploreWorkClick,
}: HeroLogoSectionProps) {
  const [logoError, setLogoError] = useState(false);
  const resolvedLogo = !logoError ? logoUrl || DEFAULT_MAIN_LOGO : "";

  return (
    <section id="top" className="relative border-b border-[#DDE3D8] bg-[#F7F8F5] py-14 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Main Website Logo Display (Efficiency for Access / Energy Saving Trust) */}
          <div className="mb-10 flex flex-col items-center">
            <div className="flex w-full max-w-2xl items-center justify-center rounded-2xl border border-[#DDE3D8] bg-[#FFFFFF] px-6 py-6 shadow-xs sm:px-10 sm:py-8">
              {resolvedLogo ? (
                <img
                  src={resolvedLogo}
                  alt="The Efficiency for Access Design Challenge team — Energy Saving Trust Logo"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="max-h-36 w-full object-contain sm:max-h-44"
                />
              ) : (
                <div className="flex items-center gap-3 text-[#15663E]">
                  <Sun className="h-9 w-9" />
                  <span
                    className="text-2xl font-bold tracking-tight text-[#132219]"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                  >
                    SolarHarvest
                  </span>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-[#596D60]">
              Solar-Powered Smart Irrigation · Fertigation · AI Pest Detection
            </p>
          </div>

          <h1
            className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-[#132219] sm:text-5xl lg:text-[3.5rem]"
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              textWrap: "balance",
            }}
          >
            Field-Tested Solar Smart Irrigation &amp; AI Pest Detection for Guava Orchards
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#4A5D51] sm:text-lg">
            Integrating clean solar energy with automated drip irrigation, embedded sensor
            interfacing, AI-based pest detection, and Energy Saving Trust Monitoring &amp;
            Evaluation reporting across 1-acre and 3-acre guava deployments.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={onBookSlotClick}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#15663E] px-7 py-3 text-base font-semibold text-white transition-colors duration-150 hover:bg-[#105131] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15663E] focus-visible:ring-offset-2 sm:w-auto whitespace-nowrap shrink-0"
            >
              <CalendarDays className="h-4 w-4" />
              Book a Slot
            </button>
            <button
              type="button"
              onClick={onExploreWorkClick}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-[#C9D3C3] bg-[#FFFFFF] px-6 py-3 text-base font-medium text-[#132219] transition-colors duration-150 hover:border-[#15663E] hover:text-[#15663E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15663E] sm:w-auto whitespace-nowrap shrink-0"
            >
              View Our Work
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
