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

const AAC_BLUE = "#0E56F5";
const AAC_GREEN = "#50C878";

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
    <section className="border-t border-border/60 bg-background">
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        {/* Section header */}
        <div className="max-w-2xl mb-14 md:mb-20">
          <div className="inline-flex items-center gap-2 mb-5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: AAC_GREEN }}
              aria-hidden
            />
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
              What's Inside
            </p>
          </div>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.08] mb-5">
            Your home search,{" "}
            <span style={{ color: AAC_BLUE }}>elevated</span>.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            A free account unlocks the tools serious buyers use to stay ahead of
            the market.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group bg-background p-8 md:p-10 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start gap-4">
                <div
                  className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: `${AAC_BLUE}0F` }}
                >
                  <Icon className="w-5 h-5" style={{ color: AAC_BLUE }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-base font-semibold text-foreground tracking-tight">
                      {title}
                    </h3>
                    <span
                      className="inline-block w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: AAC_GREEN }}
                      aria-hidden
                    />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 md:mt-16 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/consumer/auth?mode=signup"
            className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: AAC_BLUE }}
          >
            Create your free account
          </Link>
          <p className="text-xs text-muted-foreground">
            No credit card. Takes under a minute.
          </p>
        </div>
      </div>
    </section>
  );
};

export default DcmlsWhatsInside;
