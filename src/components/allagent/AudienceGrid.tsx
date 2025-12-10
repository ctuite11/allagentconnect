import { Home, Building2, Users, Share2, GraduationCap, Award } from "lucide-react";

const AudienceGrid = () => {
  const audiences = [
    { icon: Home, title: "Residential Agents" },
    { icon: Building2, title: "Commercial Brokers" },
    { icon: Users, title: "Teams" },
    { icon: Share2, title: "Referral Specialists" },
    { icon: GraduationCap, title: "New Agents" },
    { icon: Award, title: "Veteran Brokers" },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-sm font-medium tracking-wide uppercase text-blue-600 mb-3">
            Who It's For
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-4 tracking-tight">
            Built for Every Type of Agent
          </h2>
          <p className="text-slate-500 text-lg">
            Whether you're starting out or running a team, there's a place for you.
          </p>
        </div>

        {/* Audience grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
          {audiences.map((audience, index) => (
            <div
              key={index}
              className="text-center p-6 rounded-2xl bg-slate-50"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <audience.icon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-sm font-medium text-slate-700">
                {audience.title}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AudienceGrid;
