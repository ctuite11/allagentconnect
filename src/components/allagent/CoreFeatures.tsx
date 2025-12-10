import { Radio, Lock, RefreshCw, MessageCircle } from "lucide-react";

const CoreFeatures = () => {
  const features = [
    {
      icon: Radio,
      title: "Buyer Need Broadcasting",
      description: "Broadcast qualified buyer needs directly to agents with matching inventory.",
    },
    {
      icon: Lock,
      title: "Off-Market Inventory",
      description: "Access exclusive inventory before it hits the public market.",
    },
    {
      icon: RefreshCw,
      title: "Referral Exchange",
      description: "Seamless referral management with transparent commission tracking.",
    },
    {
      icon: MessageCircle,
      title: "Direct Connections",
      description: "Agent-to-agent communication without platform interference.",
    },
  ];

  return (
    <section className="py-24 bg-slate-900">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-500 mb-4">
            Core Capabilities
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Built for How Agents Actually Work
          </h2>
        </div>

        {/* Feature grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-700/30 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-slate-900 p-8"
            >
              <div className="w-10 h-10 rounded-sm bg-slate-800 border border-slate-700 flex items-center justify-center mb-5">
                <feature.icon className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CoreFeatures;
