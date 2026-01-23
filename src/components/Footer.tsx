import { Link } from "react-router-dom";
import VersionStamp from "@/components/VersionStamp";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-xl font-bold mb-4">
              <span className="text-primary">All Agent</span>{" "}
              <span className="text-muted-foreground">Connect</span>
            </h3>
            <p className="text-muted-foreground text-sm">
              Professional agent collaboration infrastructure for off-market opportunities and private matching.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li><Link to="/register" className="hover:text-primary transition-colors">Request Access</Link></li>
              <li><Link to="/our-agents" className="hover:text-primary transition-colors">Our Agents</Link></li>
              <li><Link to="/browse" className="hover:text-primary transition-colors">Browse Properties</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link to="/agent-rules" className="hover:text-primary transition-colors">Agent Network Rules</Link></li>
              <li><Link to="/fair-housing" className="hover:text-primary transition-colors">Fair Housing</Link></li>
              <li><Link to="/cookies" className="hover:text-primary transition-colors">Cookie Policy</Link></li>
              <li><Link to="/disclosures" className="hover:text-primary transition-colors">Disclosures</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <a href="mailto:hello@allagentconnect.com" className="hover:text-primary transition-colors">
                  hello@allagentconnect.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Legal disclosures */}
        <div className="pt-6 border-t border-border mb-6">
          <p className="text-xs text-muted-foreground text-center max-w-3xl mx-auto">
            This platform is not a multiple listing service and is not affiliated with any MLS or REALTOR® association. 
            Certain platform features are protected by issued and pending U.S. patents. Unauthorized use is prohibited.
          </p>
        </div>
        
        <div className="pt-4 border-t border-border text-center text-muted-foreground">
          <p className="text-sm">&copy; {new Date().getFullYear()} All Agent Connect. All rights reserved.</p>
          <VersionStamp className="mt-2 opacity-60" />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
