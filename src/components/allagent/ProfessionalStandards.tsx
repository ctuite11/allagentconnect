import { ShieldCheck, UserCheck, Scale } from "lucide-react";

const ProfessionalStandards = () => {
  const standards = [
    {
      icon: UserCheck,
      title: "Verified Agents Only",
      description: "Every member is a licensed, active real estate professional.",
    },
    {
      icon: Scale,
      title: "High Behavioral Standards",
      description: "Professional conduct expected in every interaction.",
    },
    {
      icon: ShieldCheck,
      title: "Open Without Chaos",
      description: "Accessible platform with maintained quality and trust.",
    },
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-sm font-medium tracking-wide uppercase text-blue-600 mb-3">
            Standards
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-4 tracking-tight">
            Open Access. Professional Standards.
          </h2>
          <p className="text-slate-500 text-lg">
            A network built on trust, transparency, and mutual respect.
          </p>
        </div>

        {/* Standards grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {standards.map((standard, index) => (
            <div
              key={index}
              className="text-center p-8"
            >
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-6 shadow-sm">
                <standard.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {standard.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {standard.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProfessionalStandards;
