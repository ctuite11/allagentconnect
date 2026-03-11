import { BarChart3 } from "lucide-react";

const bullets = [
  "Patent-protected matching algorithms",
  "Agent-verified network integrity",
  "Persistent listing visibility across buyer cycles",
  "Enterprise-grade security and compliance",
];

const featureCards = [
  { title: "By Agents, For Agents", desc: "Built exclusively for licensed real estate professionals." },
  { title: "Intel that creates real demand", desc: "Surface buyer interest and match it to your listings before the public market." },
];

export default function ScalePersistenceSection() {
  return (
    <section className="py-20 md:py-28 bg-zinc-900">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Screenshot placeholder with floating cards */}
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
              <div className="text-center text-zinc-600">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Platform Screenshot</p>
              </div>
            </div>
            {/* Floating feature cards */}
            {featureCards.map((card, i) => (
              <div
                key={card.title}
                className={`absolute rounded-xl bg-zinc-800/90 backdrop-blur border border-zinc-700/50 px-4 py-3 max-w-[200px] ${
                  i === 0 ? "-right-4 top-8" : "-left-4 bottom-8"
                }`}
              >
                <p className="text-xs font-semibold text-white mb-0.5">{card.title}</p>
                <p className="text-[11px] text-zinc-400 leading-snug">{card.desc}</p>
              </div>
            ))}
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
              {bullets.map((item) => (
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
  );
}
