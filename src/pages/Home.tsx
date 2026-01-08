import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Users,
  Handshake,
  ArrowRight,
  Share2,
  Megaphone,
  MessageCircle,
  Check,
  X,
} from "lucide-react";
import NetworkGlobe from "@/components/home/NetworkGlobe";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-white text-neutral-900">
      {/* Floating utility bar (actions only - brand lives in hero) */}
      <div className="pointer-events-none absolute left-0 right-0 top-6 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-end px-6">
          {/* Actions only - no brand text here */}
          <div className="pointer-events-auto flex items-center gap-5">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Log in
            </button>

            <button
              onClick={() => navigate("/auth?mode=register&source=home")}
              className="group inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_26px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 transition-all"
            >
              Get Access
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-400">→</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <main className="pb-12">
        {/* Hero - calm, centered, confident */}
        <section className="relative w-full px-6 sm:px-10 lg:px-20 pt-24 md:pt-28 lg:pt-32 pb-16 md:pb-20">
          <div className="max-w-3xl mx-auto text-center">
            {/* Brand anchor - THE hero title, bigger than headline */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight mb-8">
              <span className="text-[#0E56F5]">All Agent</span>
              <span className="text-zinc-400"> Connect</span>
            </h1>

            {/* Globe - true 3D rotation with breathing + soft glow */}
            <div className="mx-auto mb-8 w-[160px] h-[160px] animate-aac-glow">
              <div className="animate-aac-breathe">
                <NetworkGlobe variant="hero" strokeColor="#0E56F5" fillTriangles />
              </div>
            </div>

            {/* Headline */}
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4" style={{ color: '#1D1D1F' }}>
              Where Real Deals Get Done
            </h2>

            {/* Tension line */}
            <p className="text-lg text-zinc-600 max-w-xl mx-auto mb-6">
              The deals you don't see are the ones that can change a client's life — and your bottom line.
            </p>

            {/* Capability signals */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <span className="text-sm font-medium text-zinc-500 px-3 py-1.5 rounded-full border border-zinc-200">Off-market</span>
              <span className="text-sm font-medium text-zinc-500 px-3 py-1.5 rounded-full border border-zinc-200">Coming soon</span>
              <span className="text-sm font-medium text-zinc-500 px-3 py-1.5 rounded-full border border-zinc-200">Agent-to-agent</span>
            </div>

            {/* CTA - black with emerald accent */}
            <button
              onClick={() => navigate("/auth?mode=register&source=home")}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-8 py-4 text-base font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.12)] hover:bg-zinc-900 hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
            >
              Request Access
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-400">→</span>
              </span>
            </button>

            {/* Identity line */}
            <p className="mt-8 text-sm font-medium tracking-wide text-zinc-500 uppercase">
              By Agents. For Agents. All Agents.
            </p>
          </div>
        </section>

        {/* Proof Strip */}
        <section className="py-8 md:py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm" style={{ color: '#1D1D1F' }}>
              <span className="inline-flex items-center gap-2 font-medium">
                <ShieldCheck className="h-5 w-5 text-[#0E56F5]" />
                Operating since 2016
              </span>
              <span className="inline-flex items-center gap-2 font-medium">
                <Users className="h-5 w-5 text-[#0E56F5]" />
                Thousands of agents nationwide
              </span>
              <span className="inline-flex items-center gap-2 font-medium">
                <Handshake className="h-5 w-5 text-[#0E56F5]" />
                Off-market deals closed
              </span>
            </div>
          </div>
        </section>

        {/* Built to Increase Production */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-8" style={{ color: '#1D1D1F' }}>
              Built to Increase Production
            </h2>
            
            <p className="text-center text-lg leading-relaxed text-zinc-600 max-w-2xl mx-auto">
              A private agent collaboration network designed to increase deal flow, surface hidden opportunities, and help agents close more transactions.
            </p>
            
            <p className="mt-6 text-center text-base font-medium text-zinc-700">
              More deal flow. Better matches. Fewer missed opportunities.
            </p>
            
            <div className="mt-8 max-w-2xl mx-auto space-y-4">
              <BulletItem>See off-market and pre-market opportunities before others do</BulletItem>
              <BulletItem>Match active buyers quietly, without public competition</BulletItem>
              <BulletItem>Close more deals through direct agent-to-agent collaboration</BulletItem>
              <BulletItem>Increase GCI by operating ahead of the open market</BulletItem>
            </div>
          </div>
        </section>

        {/* Success Hub — How AAC Gets Used */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-2" style={{ color: '#1D1D1F' }}>
              Success Hub — How AAC Gets Used
            </h2>
            <p className="text-center text-lg text-zinc-600 mb-2">
              Core workflows inside AAC, used daily by working agents across sales and rentals.
            </p>
            <p className="text-center text-sm text-zinc-500 mb-10">
              Supports residential sales, rentals, and agent-only opportunities across markets.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ModuleCard
                icon={Share2}
                tier="hub"
                title="Listings Exchange"
                body="Quietly share off-market sales and rental listings with verified agents — with full control over visibility and timing."
              />
              <ModuleCard
                icon={Megaphone}
                tier="hub"
                title="Buyer & Renter Needs"
                body="Post active buyer and renter demand privately, so opportunities surface without public exposure."
              />
              <ModuleCard
                icon={Users}
                tier="premium"
                title="Private Matching"
                body="Match listings, buyers, and renters before they hit the open market — or without going public at all."
              />
              <ModuleCard
                icon={MessageCircle}
                tier="premium"
                title="Agent-to-Agent Workspace"
                body="Direct, verified agent collaboration — sales and rentals — without feeds, noise, or outside interference."
              />
            </div>
          </div>
        </section>

        {/* Mid-Page CTA Band */}
        <section className="border-y border-zinc-200 bg-white py-10 md:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1D1D1F' }}>
              Ready to operate ahead of the market?
            </h3>
            <button
              onClick={() => navigate("/auth?mode=register&source=home")}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-8 py-4 text-base font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.12)] hover:bg-zinc-900 hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
            >
              Request Access
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-400">→</span>
              </span>
            </button>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-8" style={{ color: '#1D1D1F' }}>
              How It Works
            </h2>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
              <StepItem number={1} label="Verify" />
              <StepItem number={2} label="Connect" />
              <StepItem number={3} label="Close" />
            </div>
          </div>
        </section>

        {/* Why Clients Love It */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-8" style={{ color: '#1D1D1F' }}>
              Why Clients Love When Their Agent Is in AAC
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <ClientBenefitCard
                title="For Sellers"
                benefits={[
                  "Discreet exposure to serious buyers before going public",
                  "Faster, higher-quality feedback from active agents",
                  "A smarter launch strategy, not an all-or-nothing gamble",
                ]}
              />
              <ClientBenefitCard
                title="For Buyers"
                benefits={[
                  "Early access to opportunities they'll never see online",
                  "Less competition and fewer bidding wars",
                  "Better outcomes through agent collaboration",
                ]}
              />
            </div>
          </div>
        </section>

        {/* The AAC Advantage */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-8" style={{ color: '#1D1D1F' }}>
              The AAC Advantage
            </h2>
            
            <div className="max-w-2xl mx-auto space-y-4">
              <BulletItem>AAC members collaborate privately instead of competing publicly</BulletItem>
              <BulletItem>Opportunities circulate inside the network before hitting the market</BulletItem>
              <BulletItem>Members see deals non-members never do</BulletItem>
              <BulletItem>Built by working agents who actually close transactions</BulletItem>
            </div>

            <p className="mt-10 text-center text-lg font-medium text-zinc-700 max-w-2xl mx-auto">
              AAC members don't wait for the market. They operate ahead of it.
            </p>
          </div>
        </section>

        {/* Coming Soon */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-8" style={{ color: '#1D1D1F' }}>
              Coming Soon
            </h2>
            
            <div className="max-w-2xl mx-auto space-y-4">
              <BulletItem>Expanded markets and regional growth</BulletItem>
              <BulletItem>Enhanced buyer-needs matching</BulletItem>
              <BulletItem>New tools for listing presentations</BulletItem>
              <BulletItem>Additional member-only collaboration features</BulletItem>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-8" style={{ color: '#1D1D1F' }}>
                Request Access
              </h2>
              
              <div className="space-y-1 text-sm text-zinc-500">
                <p>Operating since 2016</p>
                <p>Built on proprietary, patented collaboration technology</p>
                <p>Designed to protect agent relationships and deal integrity</p>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => navigate("/auth?mode=register&source=home")}
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-8 py-4 text-base font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.12)] hover:bg-zinc-900 hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
                >
                  Request Access
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-emerald-400">→</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">All Agent Connect</span> — where real deals get done.
            <div className="mt-1 text-xs text-neutral-500">© {new Date().getFullYear()} • AAC Member Network</div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <a className="text-neutral-600 hover:text-neutral-900 transition" href="/privacy">
              Privacy
            </a>
            <a className="text-neutral-600 hover:text-neutral-900 transition" href="/terms">
              Terms
            </a>
            <button
              onClick={() => navigate("/auth?mode=register&source=home")}
              className="group inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-900 hover:-translate-y-0.5 transition-all"
            >
              Get Access
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* -------------------- Components -------------------- */

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Check className="h-4 w-4 text-[#0E56F5] flex-shrink-0 mt-1" />
      <span className="text-base text-zinc-600 leading-relaxed">{children}</span>
    </div>
  );
}

function ClientBenefitCard({
  title,
  benefits,
}: {
  title: string;
  benefits: string[];
}) {
  return (
    <div className="rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200">
      <h3 className="text-lg font-semibold mb-4" style={{ color: '#1D1D1F' }}>{title}</h3>
      <div className="space-y-3">
        {benefits.map((benefit, index) => (
          <div key={index} className="flex items-start gap-3">
            <Check className="h-4 w-4 text-[#0E56F5] flex-shrink-0 mt-0.5" />
            <span className="text-sm text-zinc-600 leading-relaxed">{benefit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div 
      className="rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <Icon className="h-6 w-6 text-[#0E56F5] mb-4" />
      <div className="text-base font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>{title}</div>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: '#86868B' }}>{body}</p>
    </div>
  );
}

function ModuleCard({
  icon: Icon,
  title,
  body,
  tier,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tier: "hub" | "premium";
}) {
  return (
    <div className="relative h-full rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200">
      {/* Tier pill - top right */}
      <span
        className={`absolute top-4 right-4 text-xs font-medium tracking-wide px-2.5 py-1 rounded-full border ${
          tier === "hub"
            ? "bg-zinc-100 text-zinc-700 border-zinc-200"
            : "bg-blue-50 text-blue-700 border-blue-200"
        }`}
      >
        {tier === "hub" ? "Success Hub" : "AAC Premium"}
      </span>

      <Icon className="h-6 w-6 text-[#0E56F5] mb-4" />
      <div className="text-base font-semibold tracking-tight text-zinc-900">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{body}</p>
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
