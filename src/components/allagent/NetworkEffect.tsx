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
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-sm font-medium tracking-wide uppercase text-blue-600 mb-3">
            Network Effect
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-4 tracking-tight">
            The More Agents, the More Powerful It Gets
          </h2>
          <p className="text-slate-500 text-lg">
            Participation creates momentum. Momentum creates deal velocity.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center p-8 rounded-2xl bg-slate-50"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-6 shadow-sm">
                <stat.icon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-4xl font-semibold text-slate-900 mb-2 tracking-tight">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-slate-700 mb-1">
                {stat.label}
              </div>
              <div className="text-sm text-slate-400">
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
