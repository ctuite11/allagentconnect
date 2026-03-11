import { Users, Share2, Target, Zap } from "lucide-react";

const testimonials = [
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
];

const useCases = [
  { icon: Share2, title: "Share Listings", desc: "Post off-market and coming-soon listings to verified agents only." },
  { icon: Target, title: "Post Buyer Needs", desc: "Broadcast buyer demand across coverage areas to find matches faster." },
  { icon: Zap, title: "Collaborate Faster", desc: "Direct agent-to-agent messaging for deals, referrals, and intel." },
];

export default function AgentTestimonialsSection() {
  return (
    <section className="py-20 md:py-28 bg-zinc-50 border-y border-zinc-200">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 mb-4">
            How agents are using All Agent Connect
          </h2>
          <p className="text-lg text-zinc-500">Real results from active network members.</p>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          {testimonials.map((t) => (
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

        {/* Use-case cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {useCases.map((uc) => (
            <div key={uc.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-4">
                <uc.icon className="h-5 w-5 text-zinc-600" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-1">{uc.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{uc.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
