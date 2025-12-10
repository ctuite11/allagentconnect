import { Link2, MessageSquare, Handshake } from "lucide-react";

const AgentOS = () => {
  const features = [
    {
      icon: Link2,
      title: "Connect",
      description: "Access verified agents across markets. Build your network with professionals who close deals.",
    },
    {
      icon: MessageSquare,
      title: "Communicate",
      description: "Broadcast buyer needs and opportunities directly to agents who can help. No middlemen.",
    },
    {
      icon: Handshake,
      title: "Collaborate",
      description: "Work deals directly with other agents. Split commissions, share inventory, close faster.",
    },
  ];

  return (
    <section className="py-24 bg-slate-900">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-500 mb-4">
            The Platform
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            The Operating System for Modern Agents
          </h2>
          <p className="text-slate-400 text-lg">
            Everything you need to grow your business, connect with peers, and close more deals.
          </p>
        </div>

        {/* Feature blocks */}
        <div className="grid md:grid-cols-3 gap-px bg-slate-700/30">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-slate-900 p-10"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-sm bg-slate-800 border border-slate-700 flex items-center justify-center mb-6">
                <feature.icon className="w-5 h-5 text-blue-500" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AgentOS;
