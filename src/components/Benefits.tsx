import { Card } from "@/components/ui/card";
import { DollarSign, Shield, Users, TrendingUp } from "lucide-react";

const Benefits = () => {
  const benefits = [
    {
      icon: DollarSign,
      title: "Save Thousands",
      description: "Our transparent pricing model has saved consumers billions in real estate transactions."
    },
    {
      icon: Shield,
      title: "Complete Transparency",
      description: "No hidden fees or surprises. Every cost is clearly outlined from the start."
    },
    {
      icon: Users,
      title: "Expert Agents",
      description: "Work with experienced professionals who put your interests first."
    },
    {
      icon: TrendingUp,
      title: "Market Insights",
      description: "Access comprehensive market data and trends to make informed decisions."
    }
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Why Choose Agent Connect</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            We're revolutionizing real estate by putting consumers first and delivering unprecedented value
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <Card key={index} className="p-6 text-center hover:shadow-custom-hover transition-all duration-300">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                  <Icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Benefits;
