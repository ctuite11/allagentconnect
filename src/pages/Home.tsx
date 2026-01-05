import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Users,
  Handshake,
  ArrowRight,
  Check,
} from "lucide-react";
import NetworkGlobe from "@/components/home/NetworkGlobe";

const ACCENT_BLUE = "text-[#0E56F5]"; // Royal Blue

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <main className="pt-20 pb-12">
        {/* Hero */}
        <section className="w-full px-6 sm:px-10 lg:px-20 pt-14 pb-10 relative min-h-[60vh] flex items-center overflow-visible">
          {/* Network globe - desktop only, behind content */}
          <NetworkGlobe />
          <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center relative z-10">
            {/* Copy */}
            <div className="max-w-xl">
              <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-normal" style={{ color: '#1D1D1F' }}>
                Where Real Deals Get Done
              </h1>

              <p className="mt-6 text-lg sm:text-xl leading-relaxed text-slate-600">
                A private agent network for off-market listings, buyer needs, and verified collaboration — built by agents, for agents.
              </p>

              <div className="mt-8">
                <button
                  onClick={() => navigate("/auth")}
                  className="inline-flex items-center justify-center rounded-2xl bg-[#0E56F5] px-8 py-4 text-base font-semibold text-white hover:bg-[#0B45C4] hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40"
                >
                  Request Access <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </div>
            </div>

            {/* NetworkGlobe is the visual on the right - handled by the component */}
            <div className="hidden lg:block" aria-hidden="true" />
          </div>
        </section>

        {/* Proof Strip */}
        <section className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-10">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm" style={{ color: '#1D1D1F' }}>
            <span className="inline-flex items-center gap-2 font-medium">
              <ShieldCheck className={`h-5 w-5 ${ACCENT_BLUE}`} />
              Operating since 2016
            </span>
            <span className="inline-flex items-center gap-2 font-medium">
              <Users className={`h-5 w-5 ${ACCENT_BLUE}`} />
              Thousands of agents nationwide
            </span>
            <span className="inline-flex items-center gap-2 font-medium">
              <Handshake className={`h-5 w-5 ${ACCENT_BLUE}`} />
              Off-market deals closed
            </span>
          </div>
        </section>

        {/* What You Can Do */}
        <section className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center" style={{ color: '#1D1D1F' }}>
            What You Can Do
          </h2>
          
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              title="Share off-market listings"
              body="Post quietly with enough context for agents to act. Control visibility and timing."
            />
            <FeatureCard
              title="Post buyer needs"
              body="Buyer needs get surfaced to the right agents — quickly, without public exposure."
            />
            <FeatureCard
              title="Collaborate privately with verified agents"
              body="Direct agent-to-agent communication. Get to a showing, an offer, or a solution fast."
            />
          </div>
        </section>

        {/* How It Works */}
        <section className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center" style={{ color: '#1D1D1F' }}>
            How It Works
          </h2>
          
          <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
            <StepItem number={1} label="Verify" />
            <StepItem number={2} label="Connect" />
            <StepItem number={3} label="Close" />
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>
              Request Access
            </h2>
            <p className="mt-4 text-slate-600">
              Verified agents only. Private infrastructure. Built for real business.
            </p>
            <div className="mt-8">
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center justify-center rounded-2xl bg-[#0E56F5] px-8 py-4 text-base font-semibold text-white hover:bg-[#0B45C4] hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40"
              >
                Request Access <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">All Agent Connect</span> — where real deals get done.
            <div className="mt-1 text-xs text-neutral-500">© {new Date().getFullYear()} • Verified agents only</div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <a className="text-neutral-600 hover:text-neutral-900 transition" href="/privacy">
              Privacy
            </a>
            <a className="text-neutral-600 hover:text-neutral-900 transition" href="/terms">
              Terms
            </a>
            <button
              onClick={() => navigate("/auth")}
              className="inline-flex items-center justify-center rounded-xl bg-[#0E56F5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B45C4] hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40"
            >
              Get Access
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* -------------------- Components -------------------- */

function FeatureCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div 
      className="rounded-2xl bg-white border border-neutral-200 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="text-base font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>{title}</div>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: '#86868B' }}>{body}</p>
    </div>
  );
}

function StepItem({
  number,
  label,
}: {
  number: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-12 w-12 rounded-full bg-[#0E56F5] flex items-center justify-center">
        <span className="text-white font-semibold">{number}</span>
      </div>
      <span className="text-base font-medium" style={{ color: '#1D1D1F' }}>{label}</span>
    </div>
  );
}
