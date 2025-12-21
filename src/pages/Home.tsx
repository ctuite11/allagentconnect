import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Users,
  Handshake,
  MessageSquare,
  MapPinned,
  Sparkles,
  ArrowRight,
  Lock,
} from "lucide-react";
import { Logo } from "@/components/brand";
import heroAbstractBg from "@/assets/hero-abstract-bg.jpg";

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(" ");

const ACCENT = "text-emerald-600";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900">
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
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
              <Lock className={cx("h-4 w-4", ACCENT)} />
              Private collaboration network for agents
            </div>

            <h1 className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">
              Where Real Deals Get Done.
            </h1>

            <div className="mt-3 text-lg sm:text-xl font-semibold tracking-tight text-slate-800">
              By Agents. For Agents. All Agents.
            </div>

            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              A professional network where agents share real inventory, buyer needs, and close transactions — quietly
              and efficiently.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
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

            {/* Trust line */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
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
          </div>

          {/* Hero Visual */}
          <div className="relative">
            {/* Subtle abstract background image */}
            <div 
              className="absolute -inset-12 -z-10 rounded-[3rem] overflow-hidden"
              style={{
                backgroundImage: `url(${heroAbstractBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.15,
              }}
            />
            
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.10)]">
              {/* Faux dashboard header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Today's Activity</div>
                  <div className="text-xs text-slate-500">Quiet intel. Real inventory. Fast matches.</div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                  <Sparkles className={cx("h-4 w-4", ACCENT)} />
                  Subtle signal
                </div>
              </div>

              {/* Faux cards */}
              <div className="mt-4 grid grid-cols-1 gap-3">
                <MiniRow
                  icon={<MapPinned className={cx("h-4 w-4", ACCENT)} />}
                  title="Off-market / coming soon"
                  meta="Shared with context • serious only"
                />
                <MiniRow
                  icon={<Users className={cx("h-4 w-4", ACCENT)} />}
                  title="Buyer need posted"
                  meta="Match within network • direct contact"
                />
                <MiniRow
                  icon={<MessageSquare className={cx("h-4 w-4", ACCENT)} />}
                  title="Agent-to-agent message"
                  meta="No noise • no spam • just business"
                />
              </div>
            </div>

            {/* Soft glow */}
            <div className="pointer-events-none absolute -inset-6 -z-20 rounded-[2.5rem] bg-gradient-to-b from-emerald-200/25 via-transparent to-transparent blur-2xl" />
          </div>
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
          <div className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">Not some agents.</span> All agents.
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
            body="No top-10% gatekeeping. If you do real business, you belong."
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
                No production thresholds, no gatekeeping
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
            <div className="mt-2 text-2xl font-semibold tracking-tight">Not some agents. All agents.</div>
            <p className="mt-3 text-slate-600">
              The value isn't exclusivity — it's participation. The bigger the serious network, the better the matches.
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

function MiniRow({
  icon,
  title,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F7F6F3] px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{meta}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-400" />
    </div>
  );
}
