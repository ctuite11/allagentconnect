import { Users, MessageSquare, Handshake } from "lucide-react";

const AgentOS = () => {
  const features = [
    {
      icon: Users,
      title: "Connect",
      description: "Access a verified network of professional agents across markets.",
    },
    {
      icon: MessageSquare,
      title: "Communicate",
      description: "Broadcast buyer needs and listing opportunities directly to relevant agents.",
    },
    {
      icon: Handshake,
      title: "Collaborate",
      description: "Work deals together with transparent, direct agent-to-agent connections.",
    },
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-sm font-medium tracking-wide uppercase text-blue-600 mb-3">
            Platform
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-4 tracking-tight">
            The Operating System for Modern Agents
          </h2>
          <p className="text-slate-500 text-lg">
            Three pillars that power every successful transaction.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="text-center p-8"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-6">
                <feature.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-500 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AgentOS;
