import { Home, Building2, Users2, Share2, Sparkles, Award } from "lucide-react";

const AudienceGrid = () => {
  const audiences = [
    {
      icon: Home,
      title: "Residential Agents",
      description: "Grow your buyer and seller business with agent collaboration.",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Building2,
      title: "Commercial Brokers",
      description: "Access off-market deals and cross-market connections.",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: Users2,
      title: "Teams",
      description: "Coordinate referrals and expand your team's reach.",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      icon: Share2,
      title: "Referral Specialists",
      description: "Build and manage your referral network efficiently.",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: Sparkles,
      title: "New Agents",
      description: "Connect with experienced agents and accelerate your career.",
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      icon: Award,
      title: "Veteran Brokers",
      description: "Leverage your experience with a modern collaboration platform.",
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            WHO IT'S FOR
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Built for{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              Every Agent
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're just starting out or closing your thousandth deal, AllAgentConnect helps you grow.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {audiences.map((audience, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl ${audience.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <audience.icon className={`w-6 h-6 ${audience.color}`} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{audience.title}</h3>
              <p className="text-sm text-muted-foreground">{audience.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AudienceGrid;
