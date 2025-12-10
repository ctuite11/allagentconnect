import { Link2, MessageSquare, Handshake } from "lucide-react";

const AgentOS = () => {
  const features = [
    {
      icon: Link2,
      title: "Connect",
      description: "Access to real, verified agents across markets. Build your network with professionals who close deals.",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: MessageSquare,
      title: "Communicate",
      description: "Broadcast buyer needs and opportunities directly to agents who can help. No middlemen, no delays.",
      gradient: "from-primary to-blue-500",
    },
    {
      icon: Handshake,
      title: "Collaborate",
      description: "Work deals directly with other agents. Split commissions, share inventory, close faster.",
      gradient: "from-emerald-500 to-teal-500",
    },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            THE PLATFORM
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            The Operating System for{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              Modern Agents
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to grow your business, connect with peers, and close more deals.
          </p>
        </div>

        {/* Feature blocks */}
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5"
            >
              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-2xl font-bold text-foreground mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>

              {/* Hover accent */}
              <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AgentOS;
