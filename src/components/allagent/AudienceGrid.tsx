import { Home, Building2, Users, Share2, Sparkles, Award } from "lucide-react";

const AudienceGrid = () => {
  const audiences = [
    {
      icon: Home,
      title: "Residential Agents",
      description: "Single-family and multi-family specialists",
    },
    {
      icon: Building2,
      title: "Commercial Brokers",
      description: "Office, retail, and industrial professionals",
    },
    {
      icon: Users,
      title: "Teams",
      description: "Collaborative groups seeking network leverage",
    },
    {
      icon: Share2,
      title: "Referral Specialists",
      description: "Agents focused on geographic referral flow",
    },
    {
      icon: Sparkles,
      title: "New Agents",
      description: "Professionals building their network foundation",
    },
    {
      icon: Award,
      title: "Veteran Brokers",
      description: "Experienced professionals expanding reach",
    },
  ];

  return (
    <section className="py-24 bg-slate-950">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-500 mb-4">
            Who It's For
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Built for Every Type of Agent
          </h2>
        </div>

        {/* Audience grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-700/30 max-w-5xl mx-auto">
          {audiences.map((audience, index) => (
            <div
              key={index}
              className="bg-slate-900 p-8"
            >
              <div className="w-10 h-10 rounded-sm bg-slate-800 border border-slate-700 flex items-center justify-center mb-5">
                <audience.icon className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{audience.title}</h3>
              <p className="text-sm text-slate-400">{audience.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AudienceGrid;
