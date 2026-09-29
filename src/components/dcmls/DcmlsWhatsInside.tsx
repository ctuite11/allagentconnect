import React from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  Flame,
  Sparkles,
  UserPlus,
  Handshake,
  BellRing,
  type LucideIcon,
} from "lucide-react";
import { isDcmlsAuthAccessEnabled } from "@/lib/dcmlsAuthAccess";

type Feature = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

const FEATURES: Feature[] = [
  {
    icon: Heart,
    title: "Save Homes",
    desc: "Bookmark listings and revisit them anytime from any device.",
  },
  {
    icon: Flame,
    title: "Hot Sheets",
    desc: "Curated collections of homes matched to what you're looking for.",
  },
  {
    icon: Sparkles,
    title: "Early Access Listings",
    desc: "See coming-soon and off-market homes before they hit public sites.",
  },
  {
    icon: UserPlus,
    title: "Invite Your Agent",
    desc: "Loop in your trusted agent to collaborate on your home search.",
  },
  {
    icon: Handshake,
    title: "Buyer Agent Matching",
    desc: "Connect with vetted local agents who specialize in your market.",
  },
  {
    icon: BellRing,
    title: "Alerts & Updates",
    desc: "Get notified the moment a saved home changes price or status.",
  },
];

const DcmlsWhatsInside: React.FC = () => {
  return (
    <section className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 md:py-24 lg:px-10">
        <div className="max-w-2xl">
          <h2 className="font-['Instrument_Serif'] text-3xl tracking-[-0.02em] text-neutral-950 md:text-[2.5rem]">
            Your home search, elevated
          </h2>
          <p className="mt-3 font-['Manrope'] text-[15px] leading-relaxed text-neutral-600 md:text-base">
            Tools for serious buyers — early access inventory, curated matches,
            and direct connections to listing agents.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="min-w-0">
              <div className="mb-3 flex h-9 w-9 items-center justify-center border border-neutral-200 bg-white">
                <Icon className="h-4 w-4 text-neutral-900" strokeWidth={1.75} />
              </div>
              <h3 className="font-['Manrope'] text-[15px] font-semibold text-neutral-950">
                {title}
              </h3>
              <p className="mt-1.5 font-['Manrope'] text-sm leading-relaxed text-neutral-600">
                {desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {isDcmlsAuthAccessEnabled() ? (
            <>
              <Link
                to="/consumer/auth?mode=signup"
                className="inline-flex h-11 items-center justify-center rounded-md bg-neutral-950 px-6 font-['Manrope'] text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                Create your free account
              </Link>
              <p className="font-['Manrope'] text-xs text-neutral-500">
                No credit card. Takes under a minute.
              </p>
            </>
          ) : (
            <Link
              to="/browse?dcmls=1"
              className="inline-flex h-11 items-center justify-center rounded-md bg-neutral-950 px-6 font-['Manrope'] text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Browse Listings
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

export default DcmlsWhatsInside;
