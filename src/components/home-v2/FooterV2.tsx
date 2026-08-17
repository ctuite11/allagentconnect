import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const platformLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Request Access", href: "/request-access" },
  { label: "Request Demo", href: "#" },
  { label: "Login", href: "/login" },
];

const solutionsLinks = [
  { label: "For Agents", href: "#" },
  { label: "For Sellers", href: "#" },
  { label: "For Buyers", href: "#" },
];

const companyLinks = [
  { label: "About", href: "#about" },
  { label: "Network Values", href: "#network" },
  { label: "Careers", href: "#" },
  { label: "Contact Us", href: "#" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Data Usage & Security", href: "#" },
  { label: "Disclaimer", href: "/disclosures" },
  { label: "Fair Housing Notice", href: "/fair-housing" },
  { label: "Accessibility Statement", href: "#" },
];

const FooterLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  if (href.startsWith("/")) {
    return (
      <Link to={href} className="font-['Manrope'] font-medium text-white text-base hover:opacity-70 transition-opacity whitespace-nowrap">
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className="font-['Manrope'] font-medium text-white text-base hover:opacity-70 transition-opacity whitespace-nowrap">
      {children}
    </a>
  );
};

const FooterV2 = () => {
  const [email, setEmail] = useState("");

  return (
    <footer className="w-full bg-[#070708]">
      <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-[100px] pt-24 pb-0">
        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto_1fr] gap-12">
          {/* Brand */}
          <div className="flex flex-col gap-6 max-w-[320px]">
            <div className="flex items-center gap-3">
              <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-command.svg" alt="Logo" className="w-8 h-8" />
              <span className="font-['Manrope'] font-extrabold text-white text-xl tracking-[-0.8px] whitespace-nowrap">
                All Agent Connect
              </span>
            </div>
            <p className="font-['Manrope'] font-medium text-[#edeff7a6] text-base leading-[1.6]">
              Private agent network for off-market and early-stage real estate intelligence.
            </p>
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/group-1261153741.png" alt="Social icons" className="w-[200px] h-auto" />
          </div>

          {/* Platform */}
          <div className="flex flex-col gap-7">
            <span className="font-['Manrope'] font-semibold text-[#d4cfc9] text-sm tracking-[1.12px] uppercase">
              Platform
            </span>
            <nav className="flex flex-col gap-5">
              {platformLinks.map((l) => (
                <FooterLink key={l.label} href={l.href}>{l.label}</FooterLink>
              ))}
            </nav>
          </div>

          {/* Solutions */}
          <div className="flex flex-col gap-7">
            <span className="font-['Manrope'] font-semibold text-[#d4cfc9] text-sm tracking-[1.12px] uppercase">
              Solutions
            </span>
            <nav className="flex flex-col gap-5">
              {solutionsLinks.map((l) => (
                <FooterLink key={l.label} href={l.href}>{l.label}</FooterLink>
              ))}
            </nav>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-7">
            <span className="font-['Manrope'] font-semibold text-[#d4cfc9] text-sm tracking-[1.12px] uppercase">
              Company
            </span>
            <nav className="flex flex-col gap-5">
              {companyLinks.map((l) => (
                <FooterLink key={l.label} href={l.href}>{l.label}</FooterLink>
              ))}
            </nav>
          </div>

          {/* Newsletter */}
          <div className="flex flex-col gap-7 max-w-[420px]">
            <div className="flex flex-col gap-3">
              <h3 className="font-['Manrope'] font-semibold text-white text-base leading-[1.6]">
                Be First to Know What's Moving Privately
              </h3>
              <p className="font-['Manrope'] font-medium text-[#edeff7a6] text-sm leading-[1.6]">
                Member-only insights, off-market trends, and platform updates.
              </p>
            </div>
            <div className="relative h-14">
              <div className="absolute inset-0 bg-white/5 rounded-full border border-white/10" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="absolute inset-0 w-full h-full bg-transparent rounded-full pl-5 pr-36 text-white text-base font-['Manrope'] placeholder-white/40 outline-none"
              />
              <div className="absolute top-[5px] right-[5px] h-[44px]">
                <Button className="h-full px-5 bg-[#50C878] rounded-full text-black text-sm font-semibold font-['Manrope'] hover:bg-[#45b96d] whitespace-nowrap shadow-sm">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-20 flex flex-col gap-0">
          <Separator className="bg-[#ffffff1a]" />
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-7">
            {legalLinks.map((l) =>
              l.href.startsWith("/") ? (
                <Link key={l.label} to={l.href} className="font-['Manrope'] font-medium text-[#ffffffcc] text-sm hover:opacity-70 transition-opacity whitespace-nowrap">
                  {l.label}
                </Link>
              ) : (
                <a key={l.label} href={l.href} className="font-['Manrope'] font-medium text-[#ffffffcc] text-sm hover:opacity-70 transition-opacity whitespace-nowrap">
                  {l.label}
                </a>
              )
            )}
          </div>
          <Separator className="bg-[#ffffff1a]" />
          <div className="flex items-center justify-center py-8">
            <span className="font-['Manrope'] font-medium text-[#edeff7a6] text-sm text-center">
              © {new Date().getFullYear()} All Agent Connect, Inc. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterV2;
