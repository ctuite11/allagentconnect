import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Users,
  Handshake,
  MessageSquare,
  MapPinned,
  ArrowRight,
} from "lucide-react";
import NetworkGlobe from "@/components/home/NetworkGlobe";

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(" ");

const ACCENT = "text-emerald-600";

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
              <span className="whitespace-nowrap">By Agents. For Agents.</span>
              <div className="mt-3" style={{ color: '#94A3B8' }}>All Agents.</div>
            </h1>

            <div className="mt-5 text-lg sm:text-xl font-medium tracking-normal" style={{ color: '#1D1D1F' }}>
              Where real deals get done.
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center justify-center rounded-2xl bg-[#111827] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
              >
                Get Access <ArrowRight className="ml-2 h-4 w-4" />
              </button>

              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-2xl border border-[#E5E5EA] bg-white px-6 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-black/[0.02] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
              >
                See How It Works
              </a>
            </div>

            <p className="mt-5 text-sm leading-relaxed max-w-lg" style={{ color: '#86868B' }}>
              A nationwide agent network for off-market listings, buyer and renter needs, direct collaboration, and competitive deal access — built to improve agent outcomes.
            </p>
          </div>

          {/* NetworkGlobe is the visual on the right - handled by the component */}
          <div className="hidden lg:block" aria-hidden="true" />
        </div>
      </section>

      {/* Icon Benefits Strip */}
      <section className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-8">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm" style={{ color: '#86868B' }}>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className={cx("h-[18px] w-[18px]", ACCENT)} />
            Verified agents
          </span>
          <span className="inline-flex items-center gap-2">
            <MessageSquare className={cx("h-[18px] w-[18px]", ACCENT)} />
            Direct agent messaging
          </span>
          <span className="inline-flex items-center gap-2">
            <Handshake className={cx("h-[18px] w-[18px]", ACCENT)} />
            Built for real closings
          </span>
        </div>
      </section>

      {/* What happens here */}
      <section id="how" className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-10">
        <div className="p-7 sm:p-9">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>What happens here</h2>
          <p className="mt-2 sm:mt-3 max-w-2xl" style={{ color: '#86868B' }}>
            One network. Multiple ways to win.
          </p>

          <div className="mt-6 sm:mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
            <HowCard
              icon={<MapPinned className={cx("h-7 w-7", ACCENT)} />}
              title="Share off-market & coming soon"
              body="Post quietly with enough context for agents to act. Control visibility and timing."
            />
            <HowCard
              icon={<Users className={cx("h-7 w-7", ACCENT)} />}
              title="Match buyer needs in real time"
              body="Buyer needs get surfaced to the right agents — quickly, without public exposure."
            />
            <HowCard
              icon={<MessageSquare className={cx("h-7 w-7", ACCENT)} />}
              title="Direct agent-to-agent messaging"
              body="Fewer steps. Cleaner comms. Get to a showing, an offer, or a solution fast."
            />
            <HowCard
              icon={<Handshake className={cx("h-7 w-7", ACCENT)} />}
              title="Close deals with less friction"
              body="The platform exists for one thing: moving real transactions forward."
            />
          </div>
        </div>
      </section>

      {/* How deals actually come together */}
      <section id="proof" className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-10">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>How deals actually come together</h2>
            <p className="mt-2 sm:mt-3 max-w-2xl" style={{ color: '#86868B' }}>
              This is the infrastructure behind modern real estate collaboration.
            </p>
          </div>
        </div>

        <div className="mt-5 sm:mt-7 grid grid-cols-1 md:grid-cols-3 gap-5">
          <ProofCard
            icon={<ShieldCheck className={cx("h-5 w-5", ACCENT)} />}
            title="Active since 2016"
            body="Long-running agent collaboration with documented deal flow — not a beta."
          />
          <ProofCard
            icon={<Users className={cx("h-5 w-5", ACCENT)} />}
            title="Built for the full market"
            body="Open to all licensed professionals. If you do real business, you belong."
          />
          <ProofCard
            icon={<Handshake className={cx("h-5 w-5", ACCENT)} />}
            title="Real transactions"
            body="Signed. Closed. Verified. The network exists to move deals forward."
          />
        </div>
      </section>

      {/* Private by Design */}
      <section className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-10">
        <div className="p-7 sm:p-9">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>Private by design.</h2>
          <p className="mt-2 sm:mt-3 max-w-2xl leading-relaxed" style={{ color: '#86868B' }}>
            Some sellers don't want exposure. They want control, discretion, and qualified interest — without marketing noise.
          </p>
          <p className="mt-3 max-w-2xl leading-relaxed" style={{ color: '#86868B' }}>
            All Agent Connect allows agents to share opportunities privately with verified professionals, giving sellers the option to explore real demand without going public.
          </p>
          <p className="mt-5 text-sm font-medium" style={{ color: '#1D1D1F' }}>
            A better option for sellers who value privacy — and agents who value leverage.
          </p>
          <ul className="mt-5 space-y-2 text-sm" style={{ color: '#86868B' }}>
            <li>Controlled visibility — agent decides who sees what</li>
            <li>No public portals</li>
            <li>No premature days-on-market signals</li>
            <li>Real feedback from real agents</li>
          </ul>
        </div>
      </section>

      {/* Private Seller-Submitted Opportunities */}
      <section className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-10">
        <div className="p-7 sm:p-9">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>Private seller-submitted opportunities with disclosed compensation</h2>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Coming soon</span>
          </div>
          <p className="mt-2 sm:mt-3 max-w-2xl leading-relaxed" style={{ color: '#86868B' }}>
            Homeowners who want to sell discreetly can submit their property details directly to the All Agent Connect network, including seller-declared buyer-agent compensation.
          </p>
          <p className="mt-3 max-w-2xl leading-relaxed" style={{ color: '#86868B' }}>
            Opportunities are distributed only to agents whose criteria match the property — allowing agents to evaluate fit, terms, and intent before any public exposure.
          </p>
          <p className="mt-4 text-xs" style={{ color: '#94A3B8' }}>
            Compensation terms are seller-proposed and subject to negotiation.
          </p>
        </div>
      </section>

      {/* Competitive Advantage */}
      <section className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-10">
        <div className="p-7 sm:p-9">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>Competitive advantage, built in.</h2>
          <p className="mt-2 sm:mt-3 max-w-2xl leading-relaxed" style={{ color: '#86868B' }}>
            Agents use All Agent Connect to quietly compete for listings, buyers, and opportunities — anonymously when needed — without losing control of relationships or commissions.
          </p>
          <p className="mt-4 text-sm" style={{ color: '#94A3B8' }}>
            Patent-protected. Agent-first by design.
          </p>
        </div>
      </section>

      {/* Access */}
      <section id="access" className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-20 py-10 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
          <div className="lg:col-span-3 p-7">
            <h3 className="text-xl font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>Request access</h3>
            <p className="mt-2" style={{ color: '#86868B' }}>
              Verified agents only. Private infrastructure. Patent-protected technology built to give agents leverage.
            </p>

            <ul className="mt-5 space-y-3 text-sm" style={{ color: '#86868B' }}>
              <li className="flex gap-3">
                <span className={cx("mt-0.5", ACCENT)}>●</span>
                Agent-driven opportunity, not scraped consumer leads
              </li>
              <li className="flex gap-3">
                <span className={cx("mt-0.5", ACCENT)}>●</span>
                Subscription access — opportunity is not sold to the highest bidder
              </li>
              <li className="flex gap-3">
                <span className={cx("mt-0.5", ACCENT)}>●</span>
                Seller-submitted off-market opportunities shared with matching agents <span className="text-emerald-600 text-xs font-medium">(coming soon)</span>
              </li>
              <li className="flex gap-3">
                <span className={cx("mt-0.5", ACCENT)}>●</span>
                Seller-declared buyer-agent compensation displayed upfront <span className="text-emerald-600 text-xs font-medium">(coming soon)</span>
              </li>
              <li className="flex gap-3">
                <span className={cx("mt-0.5", ACCENT)}>●</span>
                Structured property details, filters, and controlled visibility
              </li>
              <li className="flex gap-3">
                <span className={cx("mt-0.5", ACCENT)}>●</span>
                Patent-approved technology designed to protect agents and clients
              </li>
            </ul>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center justify-center rounded-2xl bg-[#111827] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
              >
                Get Access <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => navigate("/agent-dashboard")}
                className="inline-flex items-center justify-center rounded-2xl border border-[#E5E5EA] bg-white px-6 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-black/[0.02] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
              >
                Learn more
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 p-7">
            <div className="text-xs" style={{ color: '#86868B' }}>Positioning</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>Built for <span style={{ color: '#94A3B8' }}>all agents.</span></div>
            <p className="mt-3" style={{ color: '#86868B' }}>
              The value is participation. The bigger the professional network, the better the matches.
            </p>

            <div className="mt-6 rounded-2xl bg-neutral-50 p-5">
              <div className="flex items-start gap-3">
                <div 
                  className="mt-0.5 h-8 w-8 flex items-center justify-center"
                  style={{
                    background: 'radial-gradient(circle, rgba(111, 184, 63, 0.05) 0%, transparent 70%)'
                  }}
                >
                  <ShieldCheck className={cx("h-5 w-5", ACCENT)} />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#1D1D1F' }}>Professional-first</div>
                  <div className="text-sm" style={{ color: '#86868B' }}>
                    Verified identities, clean comms, and a culture built around closing.
                  </div>
                </div>
              </div>
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
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:-translate-y-0.5 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            >
              Get Access
            </button>
          </div>
        </div>
      </footer>

      {/* Bloomberg-style Activity Ticker */}
      <ActivityTicker />
    </div>
  );
}

/* -------------------- Activity Ticker -------------------- */

const TICKER_ITEMS = [
  "Off-market posted • Back Bay • 2m ago",
  "Buyer need • Charlestown • 5m ago",
  "Showing scheduled • Tue 5pm",
  "Offer activity • NDA in place",
  "New listing shared • South End • 8m ago",
  "Agent message sent • 10m ago",
  "Off-market viewed • Brookline • 12m ago",
  "Buyer need matched • Cambridge • 15m ago",
];

function ActivityTicker() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-10 border-t border-neutral-200/70 bg-white/85 backdrop-blur overflow-hidden">
      <div 
        className="h-full flex items-center hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:justify-center"
        style={{
          animation: 'marquee 40s linear infinite',
        }}
      >
        {/* Duplicate content for seamless loop */}
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => (
          <span key={idx} className="flex items-center whitespace-nowrap">
            <span className="text-xs text-neutral-700 px-4">{item}</span>
            <span className="text-emerald-500">•</span>
          </span>
        ))}
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

/* -------------------- Components -------------------- */

function ProofCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div 
      className="rounded-3xl px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-transform duration-200 relative"
      style={{
        background: `linear-gradient(270deg, rgba(22,163,74,0.02) 0%, rgba(22,163,74,0.01) 35%, rgba(255,255,255,0) 70%), #FFFFFF`
      }}
    >
      <div className="absolute top-4 right-4">
        <div 
          className="h-8 w-8 flex items-center justify-center opacity-90"
          style={{
            background: 'radial-gradient(circle, rgba(111, 184, 63, 0.04) 0%, transparent 70%)'
          }}
        >
          <div className="text-emerald-600/90">{icon}</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-sm font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>{title}</div>
        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: '#86868B' }}>{body}</p>
      </div>
    </div>
  );
}

function HowCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div 
      className="rounded-3xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-transform duration-200 relative"
      style={{
        background: `linear-gradient(270deg, rgba(22,163,74,0.02) 0%, rgba(22,163,74,0.01) 35%, rgba(255,255,255,0) 70%), #FFFFFF`
      }}
    >
      <div className="absolute top-5 right-5">
        <div 
          className="h-10 w-10 flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(111, 184, 63, 0.05) 0%, transparent 70%)'
          }}
        >
          <div className="text-emerald-600">{icon}</div>
        </div>
      </div>
      <div className="mt-6">
        <div className="text-base font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>{title}</div>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: '#86868B' }}>{body}</p>
      </div>
    </div>
  );
}
