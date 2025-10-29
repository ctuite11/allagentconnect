import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { UserCheck, Shield, Search, MessageSquare } from "lucide-react";

const AgentIdentificationSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Clearly Identify Listing Agents or Hire a Buyer Agent
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              AllAgentConnect empowers home buyers by providing transparency and choice in agent representation
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Direct Connection */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <UserCheck className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Work with Listing Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Every property listing clearly displays the listing agent's information, allowing you to contact them directly.
                </p>
                <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold">Benefits:</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">✓</span>
                      <span>Direct communication with the agent who knows the property best</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">✓</span>
                      <span>Potential commission savings passed to you</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">✓</span>
                      <span>Faster response times and insider property knowledge</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">✓</span>
                      <span>Simplified negotiation process with one agent</span>
                    </li>
                  </ul>
                </div>
                <Button className="w-full" onClick={() => navigate("/browse")}>
                  <Search className="h-4 w-4 mr-2" />
                  Browse Properties
                </Button>
              </CardContent>
            </Card>

            {/* Buyer Agent */}
            <Card className="hover:shadow-lg transition-shadow border-2 border-primary/20">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-2xl">Hire a Buyer Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Prefer dedicated representation? We connect you with verified, experienced buyer agents in your area.
                </p>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold">Benefits:</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">✓</span>
                      <span>Exclusive representation of your interests</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">✓</span>
                      <span>Expert guidance through the entire buying process</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">✓</span>
                      <span>Access to off-market and coming soon properties</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">✓</span>
                      <span>Professional negotiation on your behalf</span>
                    </li>
                  </ul>
                </div>
                <Button className="w-full" variant="outline" onClick={() => navigate("/our-agents")}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Find a Buyer Agent
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Bottom CTA */}
          <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-2">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">
                The Choice is Yours
              </h3>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                Whether you want to work directly with listing agents for potential savings, or prefer the guidance 
                of a dedicated buyer agent, AllAgentConnect gives you the transparency and options you deserve.
              </p>
              <Button size="lg" onClick={() => navigate("/submit-buyer-need")}>
                Submit Your Property Needs
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default AgentIdentificationSection;
