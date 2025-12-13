import { Radio, Home, RefreshCw, ArrowLeftRight } from "lucide-react";

const CoreFeatures = () => {
  const features = [
    {
      icon: Radio,
      title: "Buyer Need Broadcasting",
      description: "Reach listing agents instantly when you have a qualified buyer.",
    },
    {
      icon: Home,
      title: "Off-Market Inventory",
      description: "Access exclusive listings before they hit the public market.",
    },
    {
      icon: RefreshCw,
      title: "Referral Exchange",
      description: "Connect with agents in other markets for seamless referrals.",
    },
    {
      icon: ArrowLeftRight,
      title: "Direct Connections",
      description: "Agent-to-agent communication without platform interference.",
    },
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-3">
            Features
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-4 tracking-tight">
            Everything You Need to Close More Deals
          </h2>
          <p className="text-slate-500 text-lg">
            Tools designed by agents who understand real transaction workflows.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-white border border-slate-200"
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-5">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CoreFeatures;
