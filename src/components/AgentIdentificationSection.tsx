import { Card, CardContent } from "@/components/ui/card";

const AgentIdentificationSection = () => {
  return (
    <section className="py-16 px-4 bg-muted/50">
      <div className="container mx-auto max-w-6xl">
        <Card>
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold mb-4 text-center">Agent Identification</h2>
            <p className="text-lg text-muted-foreground text-center">
              Connect with experienced real estate agents in your area who can help you find your perfect property.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default AgentIdentificationSection;
