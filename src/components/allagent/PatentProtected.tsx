import { Fingerprint, Cpu, ShieldCheck } from "lucide-react";

const PatentProtected = () => {
  const features = [
    {
      icon: Fingerprint,
      title: "Proprietary Technology",
      description: "Unique infrastructure built specifically for agent collaboration.",
    },
    {
      icon: Cpu,
      title: "Unified Agent OS",
      description: "Buyer needs, off-market inventory, and direct routing in one system.",
    },
    {
      icon: ShieldCheck,
      title: "Protected Innovation",
      description: "Patent-protected technology that cannot be replicated.",
    },
  ];

  return (
    <section className="py-24 bg-slate-950">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-500 mb-4">
            Proprietary Technology
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            One of a Kind. Patent Protected.
          </h2>
          <p className="text-slate-400 text-lg">
            The only agent collaboration platform with protected, proprietary infrastructure.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-8 border border-slate-800 bg-slate-900/30"
            >
              <div className="w-10 h-10 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mb-6">
                <feature.icon className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Patent badge */}
        <div className="text-center mt-12">
          <span className="inline-flex items-center px-4 py-2 border border-slate-700 text-xs font-medium tracking-wide uppercase text-slate-400 bg-slate-900/50">
            U.S. Patent Protected Technology
          </span>
        </div>
      </div>
    </section>
  );
};

export default PatentProtected;
