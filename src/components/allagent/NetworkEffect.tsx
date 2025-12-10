import { Users, FileText, MapPin } from "lucide-react";

const NetworkEffect = () => {
  const stats = [
    {
      icon: Users,
      value: "2,500+",
      label: "Active Agents",
      description: "Verified professionals across markets",
    },
    {
      icon: FileText,
      value: "180+",
      label: "Buyer Needs / Week",
      description: "Active opportunities broadcasted",
    },
    {
      icon: MapPin,
      value: "47",
      label: "Markets Connected",
      description: "Growing geographic coverage",
    },
  ];

  return (
    <section className="py-24 bg-slate-950">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-500 mb-4">
            Network Effect
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            The More Agents, the More Powerful It Gets
          </h2>
          <p className="text-slate-400 text-lg">
            Participation creates momentum. Momentum creates deal velocity.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center p-8 border border-slate-800 bg-slate-900/50"
            >
              <div className="w-10 h-10 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mx-auto mb-6">
                <stat.icon className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
                {stat.value}
              </div>
              <div className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
                {stat.label}
              </div>
              <div className="text-sm text-slate-500">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NetworkEffect;
