import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center pt-20">
      <div className="absolute inset-0 z-0">
        <img 
          src={heroBg} 
          alt="Luxury real estate neighborhood" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/60" />
      </div>
      
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground mb-4">
            Hello. Bonjour. Hola. 你好. Ciao
          </p>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="text-primary">Revolutionizing</span> Real Estate<br />
            Through Complete Transparency
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
            Forward-thinking and consumer-focused, Direct Connect MLS has redefined the home buying and home selling process, saving consumers billions along the way.
          </p>
          
          <div className="bg-card rounded-xl shadow-custom-lg p-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">Let's help you find your dream home.</h2>
            <div className="flex gap-3">
              <Input 
                placeholder="City, State, Zip or Neighborhood"
                className="flex-1"
              />
              <Button size="lg" className="gap-2">
                <Search className="w-5 h-5" />
                Search
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
