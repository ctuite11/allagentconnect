import React from "react";
import { Link } from "react-router-dom";
import AACMonogram from "@/components/ui/AACMonogram";
import VersionStamp from "@/components/VersionStamp";

const AAC_BLUE = "#0E56F5";
const AAC_GREEN = "#50C878";

const DcmlsFooter: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-5">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-4">
              <AACMonogram className="w-7 h-7" />
              <span
                className="font-semibold tracking-tight text-foreground text-[15px]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Direct Connect <span style={{ color: AAC_BLUE }}>MLS</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              A modern home search experience for serious buyers — early access
              listings, curated hot sheets, and direct connections to vetted
              agents.
            </p>
            <div className="inline-flex items-center gap-2 mt-5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: AAC_GREEN }}
                aria-hidden
              />
              <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
                Consumer Network
              </span>
            </div>
          </div>

          {/* Discover */}
          <div className="md:col-span-2">
            <h4 className="text-xs uppercase tracking-[0.18em] text-foreground font-semibold mb-4">
              Discover
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/browse?dcmls=1" className="text-muted-foreground hover:text-foreground transition-colors">
                  Browse Listings
                </Link>
              </li>
              <li>
                <Link to="/saved" className="text-muted-foreground hover:text-foreground transition-colors">
                  Saved Homes
                </Link>
              </li>
              <li>
                <Link to="/searches" className="text-muted-foreground hover:text-foreground transition-colors">
                  Hot Sheets
                </Link>
              </li>
              <li>
                <Link to="/account" className="text-muted-foreground hover:text-foreground transition-colors">
                  Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="md:col-span-2">
            <h4 className="text-xs uppercase tracking-[0.18em] text-foreground font-semibold mb-4">
              Company
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="https://allagentconnect.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  About AAC
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@allagentconnect.com"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="md:col-span-3">
            <h4 className="text-xs uppercase tracking-[0.18em] text-foreground font-semibold mb-4">
              Legal
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link to="/fair-housing" className="text-muted-foreground hover:text-foreground transition-colors">
                  Fair Housing
                </Link>
              </li>
              <li>
                <Link to="/disclosures" className="text-muted-foreground hover:text-foreground transition-colors">
                  Disclosures
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclosure */}
        <div className="mt-14 pt-8 border-t border-border/60">
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
            Direct Connect MLS is not a multiple listing service and is not
            affiliated with any MLS or REALTOR® association. Listings are
            provided by participating agents and brokerages. Certain platform
            features are protected by issued and pending U.S. patents.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              &copy; {year} Direct Connect MLS. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Powered by{" "}
              <a
                href="https://allagentconnect.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-foreground transition-colors"
                style={{ color: AAC_BLUE }}
              >
                All Agent Connect
              </a>
            </p>
          </div>
          <VersionStamp className="mt-3 opacity-50" />
        </div>
      </div>
    </footer>
  );
};

export default DcmlsFooter;
