import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Separator } from "../../../../components/ui/separator";

const platformLinks = ["How It Works", "Request Access", "Request Demo", "Login"];
const solutionsLinks = ["For Agents", "For Sellers", "For Buyers"];
const companyLinks = ["About", "Network Values", "Careers", "Contact Us"];
const legalLinks = ["Privacy Policy", "Terms of Service", "Cookie Policy", "Data Usage & Security", "Disclaimer", "Fair Housing Notice", "Accessibility Statement"];

export const FooterSection = (): JSX.Element => {
  const [email, setEmail] = useState("");

  return (
    <footer className="w-full bg-[#070708]">
      <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-[100px] pt-24 pb-0">
        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto_1fr] gap-12 xl:gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-6 max-w-[320px]">
            <div className="flex items-center gap-3">
              <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-command.svg" alt="Logo" className="w-8 h-8" />
              <span className="[font-family:'Manrope',Helvetica] font-extrabold text-white text-xl tracking-[-0.8px] whitespace-nowrap">All Agent Connect</span>
            </div>
            <p className="[font-family:'Manrope',Helvetica] font-medium text-[#edeff7a6] text-base leading-[1.6]">
              Private agent network for off-market and early-stage real estate intelligence.
            </p>
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/group-1261153741.png" alt="Social icons" className="w-[200px] h-auto" />
          </div>

          {/* Platform */}
          <div className="flex flex-col gap-7">
            <span className="[font-family:'Manrope',Helvetica] font-semibold text-[#d4cfc9] text-sm tracking-[1.12px] uppercase">Platform</span>
            <nav className="flex flex-col gap-5">
              {platformLinks.map((l) => (
                <a key={l} href="#" className="[font-family:'Manrope',Helvetica] font-medium text-white text-base hover:opacity-70 transition-opacity whitespace-nowrap">{l}</a>
              ))}
            </nav>
          </div>

          {/* Solutions */}
          <div className="flex flex-col gap-7">
            <span className="[font-family:'Manrope',Helvetica] font-semibold text-[#d4cfc9] text-sm tracking-[1.12px] uppercase">Solutions</span>
            <nav className="flex flex-col gap-5">
              {solutionsLinks.map((l) => (
                <a key={l} href="#" className="[font-family:'Manrope',Helvetica] font-medium text-white text-base hover:opacity-70 transition-opacity whitespace-nowrap">{l}</a>
              ))}
            </nav>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-7">
            <span className="[font-family:'Manrope',Helvetica] font-semibold text-[#d4cfc9] text-sm tracking-[1.12px] uppercase">Company</span>
            <nav className="flex flex-col gap-5">
              {companyLinks.map((l) => (
                <a key={l} href="#" className="[font-family:'Manrope',Helvetica] font-medium text-white text-base hover:opacity-70 transition-opacity whitespace-nowrap">{l}</a>
              ))}
            </nav>
          </div>

          {/* Newsletter */}
          <div className="flex flex-col gap-7 max-w-[420px]">
            <div className="flex flex-col gap-3">
              <h3 className="[font-family:'Manrope',Helvetica] font-semibold text-white text-base leading-[1.6]">Be First to Know What's Moving Privately</h3>
              <p className="[font-family:'Manrope',Helvetica] font-medium text-[#edeff7a6] text-sm leading-[1.6]">Member-only insights, off-market trends, and platform updates.</p>
            </div>
            {/* Email input */}
            <div className="relative h-14">
              <div className="absolute inset-0 bg-[#ffffff0d] rounded-full border border-[#ffffff26]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="absolute inset-0 w-full h-full bg-transparent rounded-full pl-5 pr-36 text-white text-base [font-family:'Manrope',Helvetica] placeholder-[#ffffff50] outline-none"
              />
              <div className="absolute top-[5px] right-[5px] h-[44px]">
                <Button className="h-full px-5 bg-[#2537ff] rounded-full text-white text-sm font-semibold [font-family:'Manrope',Helvetica] hover:bg-[#1e2fd4] whitespace-nowrap">
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
            {legalLinks.map((l) => (
              <a key={l} href="#" className="[font-family:'Manrope',Helvetica] font-medium text-[#ffffffcc] text-sm hover:opacity-70 transition-opacity whitespace-nowrap">{l}</a>
            ))}
          </div>
          <Separator className="bg-[#ffffff1a]" />
          <div className="flex items-center justify-center py-8">
            <span className="[font-family:'Manrope',Helvetica] font-medium text-[#edeff7a6] text-sm text-center">
              © 2026 All Agent Connect, Inc. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
