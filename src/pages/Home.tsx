import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Users,
  Handshake,
  MessageSquare,
  MapPinned,
  ArrowRight,
  Lock,
} from "lucide-react";
import { Logo } from "@/components/brand";
import heroEditorial from "@/assets/hero-editorial.png";

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(" ");

const ACCENT = "text-emerald-600";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900 pb-12">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-white via-white/90 to-transparent backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
          <Logo size="md" />

          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600">
            <a className="hover:text-slate-900 transition" href="#proof">
              Proof
            </a>
            <a className="hover:text-slate-900 transition" href="#how">
              How it works
            </a>
            <a className="hover:text-slate-900 transition" href="#access">
              Access
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/auth")}
              className="hidden sm:inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-white/60 transition"
            >
              Log in
            </button>
            <button
              onClick={() => navigate("/auth?mode=register")}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,0.10)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.14)] transition"
            >
              Request access <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#FAFAF8]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-16 lg:py-24">
            {/* LEFT: content stays constrained */}
            <div className="max-w-xl">
              <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">
                Where Real Deals Get Done.
              </h1>
              <div className="mt-3 text-lg sm:text-xl font-semibold tracking-tight text-slate-800">
                By Agents. For Agents. All Agents.
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate("/auth?mode=register")}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(0,0,0,0.12)] hover:shadow-[0_14px_34px_rgba(0,0,0,0.16)] transition"
                >
                  Request Access <ArrowRight className="ml-2 h-4 w-4" />
                </button>

                <a
                  href="#how"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] transition"
                >
                  See How It Works
                </a>
              </div>
            </div>

            {/* RIGHT column placeholder only (keeps grid height) */}
            <div className="hidden lg:block" />
          </div>
        </div>

        {/* RIGHT: image full-bleed to viewport edge */}
        <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-[60vw] max-w-none hidden lg:block">
          <div className="relative">
            <img
              src={heroEditorial}
              alt=""
              className="w-full h-auto"
            />
            {/* Feather overlay (matches page bg #FAFAF8) */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `
                  linear-gradient(to left, rgba(250,250,248,0) 65%, #FAFAF8 100%),
                  linear-gradient(to top, rgba(250,250,248,0) 75%, #FAFAF8 100%),
                  linear-gradient(to bottom, rgba(250,250,248,0) 75%, #FAFAF8 100%)
                `,
              }}
            />
          </div>
        </div>
      </section>

      {/* Icon Benefits Strip */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-slate-600">
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

      {/* Proof */}
      <section id="proof" className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Built on proven closings — not theory.</h2>
            <p className="mt-2 text-slate-600 max-w-2xl">
              This isn't a "new idea." It's a working network with real behavior, real outcomes, and a track record.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
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

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">What actually happens here</h2>
          <p className="mt-2 text-slate-600 max-w-2xl">
            Simple workflow. Serious intent. The fastest path from "need" to "signed."
          </p>

          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-5">
            <HowCard
              icon={<MapPinned className={cx("h-5 w-5", ACCENT)} />}
              title="Share off-market & coming soon"
              body="Post quietly with enough context for agents to act. Control visibility and timing."
            />
            <HowCard
              icon={<Users className={cx("h-5 w-5", ACCENT)} />}
              title="Match buyer needs in real time"
              body="Buyer needs get surfaced to the right agents — quickly, without public exposure."
            />
            <HowCard
              icon={<MessageSquare className={cx("h-5 w-5", ACCENT)} />}
              title="Direct agent-to-agent messaging"
              body="Fewer steps. Cleaner comms. Get to a showing, an offer, or a solution fast."
            />
            <HowCard
              icon={<Handshake className={cx("h-5 w-5", ACCENT)} />}
              title="Close deals with less friction"
              body="The platform exists for one thing: moving real transactions forward."
            />
          </div>
        </div>
      </section>

      {/* Access */}
      <section id="access" className="mx-auto max-w-6xl px-5 py-10 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
          <div className="lg:col-span-3 rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <h3 className="text-xl font-semibold tracking-tight">Request access</h3>
            <p className="mt-2 text-slate-600">
              We keep it professional. Verified agents only. No noise. No spam. Just a network that works.
            </p>

            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className={cx("mt-0.5", ACCENT)}>●</span>
                Identity + license verification (fast)
              </li>
              <li className="flex gap-3">
                <span className={cx("mt-0.5", ACCENT)}>●</span>
                Access to collaboration + messaging
              </li>
              <li className="flex gap-3">
                <span className={cx("mt-0.5", ACCENT)}>●</span>
                No production thresholds — open to all licensed agents
              </li>
            </ul>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate("/auth?mode=register")}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(0,0,0,0.12)] hover:shadow-[0_14px_34px_rgba(0,0,0,0.16)] transition"
              >
                Start verification <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => navigate("/allagentconnect")}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] transition"
              >
                Learn more
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <div className="text-xs text-slate-500">Positioning</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">Built for all agents.</div>
            <p className="mt-3 text-slate-600">
              The value is participation. The bigger the professional network, the better the matches.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-[#F7F6F3] p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className={cx("h-5 w-5 mt-0.5", ACCENT)} />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Professional-first</div>
                  <div className="text-sm text-slate-600">
                    Verified identities, clean comms, and a culture built around closing.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/70 bg-[#FAFAF8]">
        <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">All Agent Connect</span> — where real deals get done.
            <div className="mt-1 text-xs text-slate-500">© {new Date().getFullYear()} • Verified agents only</div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <a className="text-slate-600 hover:text-slate-900 transition" href="/privacy">
              Privacy
            </a>
            <a className="text-slate-600 hover:text-slate-900 transition" href="/terms">
              Terms
            </a>
            <button
              onClick={() => navigate("/auth?mode=register")}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,0.10)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.14)] transition"
            >
              Request access
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
    <div className="fixed bottom-0 left-0 right-0 z-50 h-10 border-t border-slate-200/70 bg-white/85 backdrop-blur overflow-hidden">
      <div 
        className="h-full flex items-center hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:justify-center"
        style={{
          animation: 'marquee 40s linear infinite',
        }}
      >
        {/* Duplicate content for seamless loop */}
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => (
          <span key={idx} className="flex items-center whitespace-nowrap">
            <span className="text-xs text-slate-700 px-4">{item}</span>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.08)] transition">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl border border-slate-200 bg-[#F7F6F3] flex items-center justify-center">
          {icon}
        </div>
        <div className="text-base font-semibold tracking-tight">{title}</div>
      </div>
      <p className="mt-3 text-sm text-slate-600 leading-relaxed">{body}</p>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.08)] transition">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl border border-slate-200 bg-[#F7F6F3] flex items-center justify-center">
          {icon}
        </div>
        <div className="text-base font-semibold tracking-tight">{title}</div>
      </div>
      <p className="mt-3 text-sm text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}
