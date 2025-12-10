import { Fingerprint, Lock, Sparkles } from "lucide-react";

const PatentProtected = () => {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, hsl(var(--primary)) 0, hsl(var(--primary)) 1px, transparent 1px, transparent 20px)`,
        }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-500 text-sm font-medium mb-4">
              <Lock className="w-4 h-4" />
              PROPRIETARY TECHNOLOGY
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              One of a Kind.{" "}
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                Patent Protected.
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              AllAgentConnect isn't a copy of anything else. Our technology is proprietary, purpose-built, and legally protected.
            </p>
          </div>

          {/* Feature blocks */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Fingerprint,
                title: "Unique Technology",
                description: "Our agent collaboration system is unlike anything else in the market.",
              },
              {
                icon: Sparkles,
                title: "Unified Agent OS",
                description: "Buyer needs, off-market inventory, and direct routing—all in one platform.",
              },
              {
                icon: Lock,
                title: "Protected Innovation",
                description: "Patent-protected infrastructure that competitors can't replicate.",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="text-center p-6 rounded-2xl bg-gradient-to-b from-amber-500/5 to-transparent border border-amber-500/10"
              >
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <item.icon className="w-7 h-7 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>

          {/* Patent badge */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-card border border-border">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Lock className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-sm font-medium text-foreground">U.S. Patent Protected Technology</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PatentProtected;
