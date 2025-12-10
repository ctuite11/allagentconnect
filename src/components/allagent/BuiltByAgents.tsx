import { Target, Zap, TrendingUp } from "lucide-react";

const BuiltByAgents = () => {
  const points = [
    {
      icon: Target,
      text: "Designed from real transactions, not theory",
    },
    {
      icon: Zap,
      text: "Built to solve actual market pain points",
    },
    {
      icon: TrendingUp,
      text: "Field-tested by active agents",
    },
  ];

  return (
    <section className="py-24 bg-slate-900">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left side - statement */}
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-500 mb-4">
                Our Origin
              </p>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                Built by Agents.
                <br />
                <span className="text-blue-500">For Agents.</span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                AllAgentConnect was created by active real estate professionals who understood 
                the gaps in agent collaboration. This isn't a tech company's idea of what agents need—it's 
                what agents actually need.
              </p>
            </div>

            {/* Right side - points */}
            <div className="space-y-6">
              {points.map((point, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-5 border border-slate-800 bg-slate-950/50"
                >
                  <div className="w-10 h-10 rounded-sm bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                    <point.icon className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="text-slate-300 font-medium">{point.text}</span>
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
