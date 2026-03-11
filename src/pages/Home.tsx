import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Globe,
  BarChart3,
  Users,
  Shield,
  Zap,
  TrendingUp,
  Search,
  MessageSquare,
  Bell,
  Target,
  Lock,
  Eye,
} from "lucide-react";
import VersionStamp from "@/components/VersionStamp";
import NetworkIntelligenceSection from "@/components/home/NetworkIntelligenceSection";
import heroAgent from "@/assets/hero-agent.jpg";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white">
      {/* ─── 1. HEADER ─── */}
      <header className="absolute left-0 right-0 top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <span className="text-sm font-semibold tracking-tight">
            <span className="text-white">All Agent</span>{" "}
            <span className="text-zinc-500">Connect</span>
          </span>

          <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <button onClick={() => navigate("/home")} className="hover:text-white transition-colors">For Agents</button>
            <button onClick={() => navigate("/home")} className="hover:text-white transition-colors">Marketplace</button>
            <button onClick={() => navigate("/home")} className="hover:text-white transition-colors">Features</button>
            <button onClick={() => navigate("/our-agents")} className="hover:text-white transition-colors">Agents</button>
            <button onClick={() => navigate("/home")} className="hover:text-white transition-colors">Pricing</button>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/auth?mode=register&source=home")}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              Get Access
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ─── 2. HERO ─── */}
        <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Text */}
              <div>
                <p className="text-sm font-medium uppercase tracking-widest text-emerald-400 mb-4">
                  Private Agent Network
                </p>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                  A private agent network for{" "}
                  <span className="text-emerald-400">PRE-MLS</span>{" "}
                  intelligence.
                </h1>
                <p className="text-lg text-zinc-400 mb-8 max-w-lg">
                  Surface off-market opportunities, match buyers privately, and close deals before they hit the public feed.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => navigate("/auth?mode=register&source=home")}
                    className="rounded-full bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-emerald-500 transition-colors"
                  >
                    Get Access
                  </button>
                  <button
                    onClick={() => navigate("/auth")}
                    className="rounded-full border border-zinc-700 px-8 py-3.5 text-base font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
                  >
                    Learn More
                  </button>
                </div>
              </div>

              {/* Right: Hero image placeholder */}
              <div className="relative hidden lg:block">
                <img
                  src={heroAgent}
                  alt="Real estate agent working on laptop"
                  className="aspect-[4/5] rounded-3xl object-cover w-full"
                />
                {/* Floating stats card */}
                <div className="absolute -left-8 bottom-16 rounded-2xl bg-zinc-900/90 backdrop-blur border border-zinc-700/50 px-5 py-4">
                  <p className="text-xs text-zinc-500 mb-1">Network Matches</p>
                  <p className="text-2xl font-bold text-emerald-400">2,847</p>
                  <p className="text-xs text-zinc-500 mt-1">Active this month</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 3. NETWORK INTELLIGENCE ─── */}
        <NetworkIntelligenceSection />

        {/* ─── 4. AGENT PHOTOS ROW ─── */}
        <section className="py-16 bg-zinc-50 border-y border-zinc-200">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { name: "Sarah Chen", role: "Luxury Specialist" },
                { name: "Marcus Rivera", role: "Buyer's Agent" },
                { name: "Emily Foster", role: "Listing Expert" },
                { name: "David Kim", role: "Investment Pro" },
              ].map((agent, i) => (
                <div key={agent.name} className="text-center">
                  <div
                    className={`mx-auto w-28 h-28 rounded-full flex items-center justify-center mb-3 ${
                      i === 2
                        ? "bg-emerald-100 border-2 border-emerald-400"
                        : "bg-zinc-200 border border-zinc-300"
                    }`}
                  >
                    <Users className={`h-8 w-8 ${i === 2 ? "text-emerald-600" : "text-zinc-400"}`} />
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">{agent.name}</p>
                  <p className="text-xs text-zinc-500">{agent.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. RESULTS HUB ─── */}
        <section className="py-20 md:py-28 bg-white text-zinc-900">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
                Turning network intelligence
                <br className="hidden md:block" />
                into real results
              </h2>
              <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
                Every connection, listing, and match flows through the AAC network — turning data into deals.
              </p>
            </div>

            {/* Hub icon grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 max-w-4xl mx-auto">
              {[
                { icon: Search, label: "Discovery" },
                { icon: Target, label: "Matching" },
                { icon: MessageSquare, label: "Collaboration" },
                { icon: Bell, label: "Alerts" },
                { icon: Globe, label: "Network" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                    <Icon className="h-7 w-7 text-zinc-600" />
                  </div>
                  <span className="text-sm font-medium text-zinc-700">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 6. AGENT TESTIMONIALS ─── */}
        <section className="py-20 md:py-28 bg-zinc-50 border-y border-zinc-200">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 mb-4">
                How agents are using All Agent Connect
              </h2>
              <p className="text-lg text-zinc-500">Real results from active network members.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  quote: "I closed 3 off-market deals in my first month on AAC. The network intelligence is unmatched.",
                  name: "Jennifer Walsh",
                  market: "Boston Metro",
                },
                {
                  quote: "My buyers get first look at properties before they hit the MLS. It's a game changer for competitive markets.",
                  name: "Robert Chen",
                  market: "Greater Hartford",
                },
                {
                  quote: "The agent-to-agent matching saved me weeks of searching. Found the perfect buyer in 48 hours.",
                  name: "Maria Santos",
                  market: "Rhode Island",
                },
              ].map((t) => (
                <div
                  key={t.name}
                  className="rounded-2xl bg-white border border-zinc-200 p-7 shadow-sm"
                >
                  <p className="text-sm leading-relaxed text-zinc-600 mb-6">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-zinc-200 flex items-center justify-center">
                      <Users className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{t.name}</p>
                      <p className="text-xs text-zinc-500">{t.market}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 7. DARK FEATURE CARDS ─── */}
        <section className="py-20 md:py-28 bg-zinc-950">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-xs font-medium text-zinc-400 mb-6">
                Marketplace Tools
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
                Everything you need to
                <br className="hidden md:block" />
                close more deals
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Eye, title: "Off-Market Listings", body: "Share and discover exclusive listings before they go public." },
                { icon: Target, title: "Buyer Matching", body: "Automatically match active buyers with new and existing listings." },
                { icon: MessageSquare, title: "Agent Messaging", body: "Direct, private communication between verified agents." },
                { icon: Bell, title: "Smart Alerts", body: "Get notified when matching opportunities hit the network." },
                { icon: Shield, title: "Verified Network", body: "Every agent is license-verified for trust and compliance." },
                { icon: TrendingUp, title: "Market Intelligence", body: "Track trends and signals across your coverage areas." },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7 hover:border-zinc-700 transition-colors"
                >
                  <f.icon className="h-6 w-6 text-emerald-400 mb-4" />
                  <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 8. SCALE & PERSISTENCE ─── */}
        <section className="py-20 md:py-28 bg-zinc-900">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: Screenshot placeholder */}
              <div className="aspect-[4/3] rounded-2xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
                <div className="text-center text-zinc-600">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Platform Screenshot</p>
                </div>
              </div>

              {/* Right: Copy */}
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6">
                  Deliberately designed for scale and persistence
                </h2>
                <p className="text-zinc-400 text-lg mb-8">
                  Built on proprietary, patented technology that protects agent relationships and deal integrity at every level.
                </p>
                <div className="space-y-4">
                  {[
                    "Patent-protected matching algorithms",
                    "Agent-verified network integrity",
                    "Persistent listing visibility across buyer cycles",
                    "Enterprise-grade security and compliance",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-sm text-zinc-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 9. GCI SECTION ─── */}
        <section className="py-20 md:py-28 bg-zinc-950">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
                GCI driven by better information
                <br className="hidden md:block" />
                and faster connections
              </h2>
              <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
                Members who operate on network intelligence consistently outperform agents relying on public feeds alone.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
              {[
                { icon: Zap, label: "Speed to Market", desc: "See deals before the MLS" },
                { icon: Target, label: "Precision Matching", desc: "Buyers matched to listings" },
                { icon: Lock, label: "Deal Privacy", desc: "Off-market confidentiality" },
                { icon: Users, label: "Agent Network", desc: "Verified collaboration" },
                { icon: TrendingUp, label: "GCI Growth", desc: "Higher close rates" },
                { icon: Shield, label: "Compliance", desc: "Licensed & protected" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="text-center">
                  <div className="mx-auto h-14 w-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-3">
                    <Icon className="h-6 w-6 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-zinc-500 mt-1">{desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => navigate("/auth?mode=register&source=home")}
                className="rounded-full bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                Get Access
              </button>
            </div>
          </div>
        </section>

        {/* ─── 10. FINAL CTA ─── */}
        <section className="py-24 md:py-32 bg-zinc-900 border-t border-zinc-800">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">
              See the Market Before
              <br />
              it Happens
            </h2>
            <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto">
              Join the private agent network where deals are made before they reach the public market.
            </p>
            <button
              onClick={() => navigate("/auth?mode=register&source=home")}
              className="rounded-full bg-emerald-600 px-10 py-4 text-lg font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              Get Access
              <ArrowRight className="inline-block ml-2 h-5 w-5" />
            </button>
          </div>
        </section>
      </main>

      {/* ─── 11. FOOTER ─── */}
      <footer className="bg-zinc-950 border-t border-zinc-800 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div>
              <span className="text-sm font-semibold tracking-tight">
                <span className="text-white">All Agent</span>{" "}
                <span className="text-zinc-500">Connect</span>
              </span>
              <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                Professional agent collaboration infrastructure for off-market opportunities and private matching.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-4">Platform</h4>
              <ul className="space-y-2.5 text-sm text-zinc-500">
                <li><a href="/register" className="hover:text-zinc-300 transition-colors">Request Access</a></li>
                <li><a href="/our-agents" className="hover:text-zinc-300 transition-colors">Our Agents</a></li>
                <li><a href="/browse" className="hover:text-zinc-300 transition-colors">Browse Properties</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-4">Legal</h4>
              <ul className="space-y-2.5 text-sm text-zinc-500">
                <li><a href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</a></li>
                <li><a href="/agent-rules" className="hover:text-zinc-300 transition-colors">Agent Network Rules</a></li>
                <li><a href="/fair-housing" className="hover:text-zinc-300 transition-colors">Fair Housing</a></li>
                <li><a href="/disclosures" className="hover:text-zinc-300 transition-colors">Disclosures</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-4">Contact</h4>
              <ul className="space-y-2.5 text-sm text-zinc-500">
                <li>
                  <a href="mailto:hello@allagentconnect.com" className="hover:text-zinc-300 transition-colors">
                    hello@allagentconnect.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-800 mb-6">
            <p className="text-xs text-zinc-600 text-center max-w-3xl mx-auto">
              This platform is not a multiple listing service and is not affiliated with any MLS or REALTOR® association.
              Certain platform features are protected by issued and pending U.S. patents. Unauthorized use is prohibited.
            </p>
          </div>

          <div className="pt-4 border-t border-zinc-800 text-center">
            <p className="text-sm text-zinc-600">© {new Date().getFullYear()} All Agent Connect. All rights reserved.</p>
            <VersionStamp className="mt-2 opacity-40" />
          </div>
        </div>
      </footer>
    </div>
  );
}
