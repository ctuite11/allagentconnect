import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, FileStack, MessageSquare, Users, Shield, ArrowRight } from "lucide-react";

const AllAgentConnectHome = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>AllAgentConnect | Agent Collaboration Platform</title>
        <meta 
          name="description" 
          content="The agent-first collaboration platform. Search listings, manage hot sheets, and connect with verified agents." 
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero - Simple, tool-first */}
        <section className="border-b border-border">
          <div className="max-w-[1280px] mx-auto px-6 py-20 md:py-28">
            <div className="max-w-2xl">
              <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight mb-4">
                The operating system for real estate agents.
              </h1>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Search inventory, manage client hot sheets, and collaborate with verified agents—all in one workspace.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => navigate("/listing-search")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Open Listing Search
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate("/auth")}
                >
                  Create Account
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards - 3 columns */}
        <section className="border-b border-border">
          <div className="max-w-[1280px] mx-auto px-6 py-16">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-8">
              Core Tools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Search */}
              <div className="border border-border rounded-lg p-6 bg-card">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Listing Search</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  MLS-style search across all inventory. Filter by status, price, location, and criteria.
                </p>
              </div>

              {/* Hotsheets */}
              <div className="border border-border rounded-lg p-6 bg-card">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
                  <FileStack className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Hot Sheets</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Automated listing alerts for your clients. Save searches and deliver matches instantly.
                </p>
              </div>

              {/* Connect */}
              <div className="border border-border rounded-lg p-6 bg-card">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Agent Network</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Find buyer agents with matching clients. Share off-market inventory securely.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Workspace Navigation */}
        <section className="border-b border-border">
          <div className="max-w-[1280px] mx-auto px-6 py-16">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-8">
              Your Workspace
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button 
                onClick={() => navigate("/listing-search")}
                className="border border-border border-l-4 border-l-primary rounded-lg p-5 bg-card text-left hover:bg-muted/50 transition-colors"
              >
                <Search className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-medium text-foreground">Listing Search</h3>
                <p className="text-xs text-muted-foreground mt-1">Search all inventory</p>
              </button>

              <button 
                onClick={() => navigate("/hot-sheets")}
                className="border border-border border-l-4 border-l-primary rounded-lg p-5 bg-card text-left hover:bg-muted/50 transition-colors"
              >
                <FileStack className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-medium text-foreground">Hot Sheets</h3>
                <p className="text-xs text-muted-foreground mt-1">Manage client alerts</p>
              </button>

              <button 
                onClick={() => navigate("/communication-center")}
                className="border border-border border-l-4 border-l-primary rounded-lg p-5 bg-card text-left hover:bg-muted/50 transition-colors"
              >
                <MessageSquare className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-medium text-foreground">Communications</h3>
                <p className="text-xs text-muted-foreground mt-1">Outbound campaigns</p>
              </button>

              <button 
                onClick={() => navigate("/agent-search")}
                className="border border-border border-l-4 border-l-primary rounded-lg p-5 bg-card text-left hover:bg-muted/50 transition-colors"
              >
                <Users className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-medium text-foreground">Agent Directory</h3>
                <p className="text-xs text-muted-foreground mt-1">Find verified agents</p>
              </button>
            </div>
          </div>
        </section>

        {/* Credibility Section */}
        <section className="border-b border-border">
          <div className="max-w-[1280px] mx-auto px-6 py-16">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Why AAC
                </h2>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Built by agents, for agents.
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>Your listing, your lead. No lead routing or buyer capture.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>Patent-protected collaboration model.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>Agent-first. No consumer marketing or IDX feeds.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Minimal Footer */}
        <footer className="bg-card border-t border-border">
          <div className="max-w-[1280px] mx-auto px-6 py-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} AllAgentConnect. All rights reserved.
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <button 
                  onClick={() => navigate("/auth")}
                  className="hover:text-foreground transition-colors"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => navigate("/auth")}
                  className="hover:text-foreground transition-colors"
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default AllAgentConnectHome;
