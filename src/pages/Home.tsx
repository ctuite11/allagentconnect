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
    <div className="min-h-screen bg-white text-neutral-900">
      <main className="pt-14 pb-12">
        {/* Hero */}
        <section className="w-full px-6 sm:px-10 lg:px-20 pt-8 pb-10 relative min-h-[620px] lg:min-h-[680px] flex items-center overflow-visible">
          {/* Background globe layer - two-layer absolute for zero layout impact */}
          <div className="pointer-events-none absolute inset-0 overflow-visible">
            <div className="absolute right-[-60px] top-[-92px] md:top-[-110px] lg:top-[-128px] lg:right-[-40px] xl:right-[-20px] 2xl:right-0">
              <NetworkGlobe />
            </div>
          </div>
          
          {/* Foreground content */}
          <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center relative z-10">
            {/* Copy */}
            <div className="max-w-xl pt-10 md:pt-14 lg:pt-16">
              {/* Badge - anchor for the eye */}
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 bg-white/70 text-xs font-medium tracking-wide uppercase text-zinc-700 mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0E56F5]" />
                AAC Private Network
              </span>

              <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-normal" style={{ color: '#1D1D1F' }}>
                Where Real Deals Get Done
              </h1>

              {/* Tension line */}
              <p className="mt-4 text-base font-medium text-zinc-600">
                The deals you don't see are the ones that can change a client's life — and your bottom line.
              </p>

              {/* Identity line */}
              <p className="mt-5 text-base font-semibold tracking-wide text-zinc-700 uppercase">
                By Agents. For Agents. All Agents.
              </p>

              {/* Capability signals */}
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="text-sm font-medium text-zinc-500 px-3 py-1.5 rounded-full border border-zinc-200">Off-market</span>
                <span className="text-sm font-medium text-zinc-500 px-3 py-1.5 rounded-full border border-zinc-200">Coming soon</span>
                <span className="text-sm font-medium text-zinc-500 px-3 py-1.5 rounded-full border border-zinc-200">Agent-to-agent</span>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => navigate("/register")}
                  className="inline-flex items-center justify-center rounded-2xl bg-[#0E56F5] px-8 py-4 text-base font-semibold text-white hover:bg-[#0B45C4] hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40"
                >
                  Request Access <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Globe context removed - globe is now atmospheric backplate only */}
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

        {/* What You Can Do */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-8" style={{ color: '#1D1D1F' }}>
              What You Can Do
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FeatureCard
                icon={Share2}
                title="Share off-market listings"
                body="Post quietly with enough context for agents to act. Control visibility and timing."
              />
              <FeatureCard
                icon={Megaphone}
                title="Post buyer needs"
                body="Buyer needs get surfaced to the right agents — quickly, without public exposure."
              />
              <FeatureCard
                icon={MessageCircle}
                title="Collaborate privately with verified agents"
                body="Direct agent-to-agent communication. Get to a showing, an offer, or a solution fast."
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
              onClick={() => navigate("/register")}
              className="inline-flex items-center justify-center rounded-2xl bg-[#0E56F5] px-8 py-4 text-base font-semibold text-white hover:bg-[#0B45C4] hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40"
            >
              Request Access <ArrowRight className="ml-2 h-5 w-5" />
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
                  onClick={() => navigate("/register")}
                  className="inline-flex items-center justify-center rounded-2xl bg-[#0E56F5] px-8 py-4 text-base font-semibold text-white hover:bg-[#0B45C4] hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40"
                >
                  Request Access <ArrowRight className="ml-2 h-5 w-5" />
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
              onClick={() => navigate("/register")}
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
