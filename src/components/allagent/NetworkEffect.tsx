import { Users, TrendingUp, MapPin, Zap } from "lucide-react";

const NetworkEffect = () => {
  const stats = [
    {
      icon: Users,
      value: "2,500+",
      label: "Active Agents",
      description: "Growing daily",
    },
    {
      icon: TrendingUp,
      value: "500+",
      label: "Buyer Needs / Week",
      description: "Real opportunities",
    },
    {
      icon: MapPin,
      value: "150+",
      label: "Markets Connected",
      description: "Nationwide reach",
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-slate-950 to-slate-900 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--primary) / 0.1) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--primary) / 0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Animated connection lines */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20">
        <div className="absolute inset-0 border-2 border-primary/30 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
        <div className="absolute inset-8 border border-emerald-500/20 rounded-full animate-ping" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
        <div className="absolute inset-16 border border-blue-500/20 rounded-full animate-ping" style={{ animationDuration: '5s', animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            NETWORK EFFECT
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            The More Agents, the More{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Powerful It Gets
            </span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Every agent who joins amplifies the network. More connections mean more deals, more referrals, and more velocity.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/20 flex items-center justify-center">
                <stat.icon className="w-8 h-8 text-primary" />
              </div>
              <div className="text-5xl font-bold text-white mb-2">{stat.value}</div>
              <div className="text-lg font-medium text-white/80 mb-1">{stat.label}</div>
              <div className="text-sm text-white/50">{stat.description}</div>
            </div>
          ))}
        </div>

        {/* Momentum message */}
        <div className="mt-16 text-center">
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            <span className="text-primary font-semibold">Participation creates momentum.</span>{" "}
            Momentum creates deal velocity. Join the agents who are already winning.
          </p>
        </div>
      </div>
    </section>
  );
};

export default NetworkEffect;
