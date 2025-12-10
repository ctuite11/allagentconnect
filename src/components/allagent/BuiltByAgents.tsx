import { Users, Briefcase, Target, Heart } from "lucide-react";

const BuiltByAgents = () => {
  const points = [
    {
      icon: Briefcase,
      text: "Designed from real transactions",
    },
    {
      icon: Target,
      text: "Solves actual market pain points",
    },
    {
      icon: Users,
      text: "Created by working agents",
    },
    {
      icon: Heart,
      text: "Field-tested, not theoretical",
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/3 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left visual */}
          <div className="order-2 lg:order-1">
            <div className="relative">
              {/* Main card */}
              <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">Built by Agents</div>
                    <div className="text-white/60">For Agents</div>
                  </div>
                </div>

                {/* Quote */}
                <blockquote className="text-lg text-white/80 italic border-l-4 border-primary pl-4">
                  "We built what we wished existed. Every feature comes from real deals, real frustrations, and real wins."
                </blockquote>
                <div className="mt-4 text-sm text-white/50">— The AllAgentConnect Team</div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-6 -right-6 p-4 rounded-xl bg-primary/20 border border-primary/30 backdrop-blur-sm">
                <div className="text-2xl font-bold text-white">20+</div>
                <div className="text-xs text-white/60">Years Combined</div>
              </div>
            </div>
          </div>

          {/* Right content */}
          <div className="order-1 lg:order-2">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              OUR STORY
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Built by Agents.{" "}
              <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                For Agents.
              </span>
            </h2>
            <p className="text-lg text-white/60 mb-8 leading-relaxed">
              AllAgentConnect wasn't designed in a boardroom by tech executives. It was built by agents who were tired of broken systems, missed opportunities, and platforms that work against them.
            </p>

            {/* Points */}
            <div className="grid sm:grid-cols-2 gap-4">
              {points.map((point, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <point.icon className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-white/80 text-sm font-medium">{point.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BuiltByAgents;
