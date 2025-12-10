import { CheckCircle2, UserCheck, Scale, Eye } from "lucide-react";

const ProfessionalStandards = () => {
  const standards = [
    {
      icon: UserCheck,
      title: "Verified Agents Only",
      description: "Every member is a licensed, verified real estate professional.",
    },
    {
      icon: Scale,
      title: "High Behavioral Standards",
      description: "Professional conduct is expected and enforced. No spam, no games.",
    },
    {
      icon: Eye,
      title: "Transparent Operations",
      description: "Clear rules, fair practices, and honest communication.",
    },
  ];

  return (
    <section className="py-24 bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium mb-4">
              PROFESSIONAL NETWORK
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Open Access.{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Professional Standards.
              </span>
            </h2>
            <p className="text-lg text-white/60 mb-8 leading-relaxed">
              AllAgentConnect is open to all qualified agents—but membership comes with expectations. 
              We maintain a high-quality network by holding everyone to professional standards.
            </p>

            {/* Standards list */}
            <div className="space-y-6">
              {standards.map((standard, index) => (
                <div key={index} className="flex gap-4">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <standard.icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{standard.title}</h3>
                    <p className="text-white/60">{standard.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right visual */}
          <div className="relative">
            <div className="aspect-square rounded-3xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/10 p-8 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
                <div className="text-3xl font-bold text-white mb-2">100%</div>
                <div className="text-lg text-white/70">Verified Professionals</div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-4 -right-4 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm">
              <span className="text-sm font-medium text-emerald-400">Licensed</span>
            </div>
            <div className="absolute -bottom-4 -left-4 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-sm">
              <span className="text-sm font-medium text-cyan-400">Vetted</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProfessionalStandards;
