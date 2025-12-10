import { Shield, ArrowRight } from "lucide-react";

const ListingOwnership = () => {
  return (
    <section className="py-24 bg-gradient-to-r from-primary/5 via-background to-emerald-500/5 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/25">
            <Shield className="w-10 h-10 text-white" />
          </div>

          {/* Main statement */}
          <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
            Your Listing.{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              Your Lead.
            </span>{" "}
            Always.
          </h2>

          {/* Supporting text */}
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            At AllAgentConnect, you own your relationships and your leads. We never compete with you for business. 
            Every connection you make, every deal you close—it's yours.
          </p>

          {/* Key points */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {[
              "No lead capture by platform",
              "Direct agent relationships",
              "You control your contacts",
              "Full commission transparency",
            ].map((point, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border"
              >
                <ArrowRight className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ListingOwnership;
