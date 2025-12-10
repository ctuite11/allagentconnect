import { Shield, CheckCircle2, Users } from "lucide-react";

const ProfessionalStandards = () => {
  const standards = [
    {
      icon: Shield,
      title: "Verified Agents Only",
      description: "Every member is a licensed, verified real estate professional.",
    },
    {
      icon: CheckCircle2,
      title: "High Behavioral Standards",
      description: "Professional conduct expectations enforced across the network.",
    },
    {
      icon: Users,
      title: "Open Participation",
      description: "Accessible to all qualified agents without gatekeeping.",
    },
  ];

  return (
    <section className="py-24 bg-slate-900">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-500 mb-4">
            Standards
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Open Access. Professional Standards.
          </h2>
          <p className="text-slate-400 text-lg">
            We believe in open participation without sacrificing professionalism.
          </p>
        </div>

        {/* Standards grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {standards.map((standard, index) => (
            <div
              key={index}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-sm bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-6">
                <standard.icon className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">{standard.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{standard.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProfessionalStandards;
