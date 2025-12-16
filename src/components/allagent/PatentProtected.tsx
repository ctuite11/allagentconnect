import { Lock, Cpu, Network } from "lucide-react";

const PatentProtected = () => {
  const features = [
    {
      icon: Cpu,
      title: "Proprietary Technology",
      description: "Purpose-built infrastructure for agent collaboration.",
    },
    {
      icon: Network,
      title: "Unified Agent OS",
      description: "One platform connecting buyer needs, listings, and agents.",
    },
    {
      icon: Lock,
      title: "Protected Innovation",
      description: "Patent-protected systems you won't find anywhere else.",
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-sm font-medium tracking-wide uppercase text-primary mb-3">
            Technology
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4 tracking-tight">
            One of a Kind. Patent Protected.
          </h2>
          <p className="text-muted-foreground text-lg">
            The only platform built specifically for agent-to-agent deal flow.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-muted"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center mb-5 shadow-sm">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PatentProtected;
