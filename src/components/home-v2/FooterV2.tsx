import React from "react";
import { Link } from "react-router-dom";
import footerLogo from "@/assets/home/vuesax-bold-command.svg";

const platformLinks = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Member preview", href: "/#member-preview" },
  { label: "Request access", href: "/request-access" },
  { label: "Login", href: "/login" },
];

const exploreLinks = [
  { label: "For licensed agents", href: "/#how-it-works" },
  { label: "Off-market listing network", href: "/off-market-listing-network" },
  { label: "Frequently asked questions", href: "/faq" },
  { label: "Agent Network Rules", href: "/agent-rules" },
];

const companyLinks = [
  { label: "About & founder", href: "/about" },
  { label: "Contact Us", href: "mailto:hello@allagentconnect.com" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Disclosures", href: "/disclosures" },
  { label: "Fair Housing Notice", href: "/fair-housing" },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className = "font-['Manrope'] font-medium text-white/85 text-sm hover:text-white underline-offset-4 focus-visible:underline";
  // Full navigation to home anchors also works from /faq or other public pages.
  if (href.startsWith("/#")) return <a href={href} className={className}>{children}</a>;
  return href.startsWith("/") ? <Link to={href} className={className}>{children}</Link> :
    <a href={href} className={className}>{children}</a>;
}

function FooterColumn({ title, links }: { title: string; links: {label: string; href: string}[] }) {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="font-['Manrope'] font-semibold text-white/65 text-xs uppercase tracking-wider">{title}</h3>
      <nav aria-label={title} className="flex flex-col gap-4">
        {links.map(link => <FooterLink key={link.label} href={link.href}>{link.label}</FooterLink>)}
      </nav>
    </div>
  );
}

export default function FooterV2() {
  return (
    <footer className="w-full bg-[#070708] text-white">
      <div className="mx-auto max-w-[1440px] px-6 py-14 lg:px-[100px]">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-[340px]">
            <div className="flex items-center gap-3">
              <img src={footerLogo} alt="" aria-hidden="true" className="h-8 w-8" />
              <span className="font-['Manrope'] font-bold text-xl">All Agent Connect</span>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-white/70">
              A private network for verified real estate agents to share buyer needs, discuss properties being prepared for sale, and work across brokerages.
            </p>
            <p className="mt-4 text-sm text-white/70">Based in Greater Boston. Membership is for licensed agents, not the public.</p>
          </div>
          <FooterColumn title="Platform" links={platformLinks} />
          <FooterColumn title="Explore" links={exploreLinks} />
          <FooterColumn title="Company" links={companyLinks} />
        </div>
        <nav aria-label="Legal" className="mt-14 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/15 pt-7">
          {legalLinks.map(link => <FooterLink key={link.label} href={link.href}>{link.label}</FooterLink>)}
        </nav>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-white/60">
          All Agent Connect is not a multiple listing service and is not affiliated with any MLS or REALTOR® association.
          Agents must follow applicable MLS, brokerage, and seller requirements when sharing property information.
        </p>
        <p className="mt-8 text-center text-sm text-white/60">© {new Date().getFullYear()} All Agent Connect, Inc. All rights reserved.</p>
      </div>
    </footer>
  );
}
