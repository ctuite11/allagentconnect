import React from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";

const columns = [
  {
    title: "All Agent Connect",
    links: [
      { label: "About", href: "#about" },
      { label: "Network", href: "#network" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "Results", href: "#results" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Agent Search", href: "/our-agents" },
      { label: "Browse Properties", href: "/browse" },
      { label: "IDX Search", href: "/idx" },
      { label: "Login", href: "/auth" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Fair Housing", href: "/fair-housing" },
      { label: "Disclosures", href: "/disclosures" },
    ],
  },
];

const FooterV2 = () => {
  return (
    <footer className="bg-zinc-950 text-zinc-400 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="grid md:grid-cols-4 gap-10 lg:gap-16">
          {/* Brand block */}
          <div>
            <Logo variant="reversed" size="md" />
            <p className="mt-4 text-sm text-zinc-500 leading-relaxed max-w-[240px]">
              The private network where agents share off-market intelligence and close deals faster.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-zinc-300 mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link to={link.href} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Legal bottom row */}
        <div className="mt-14 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} All Agent Connect. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link to="/terms" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Terms</Link>
            <Link to="/cookies" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterV2;
