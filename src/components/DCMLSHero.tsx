import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const parseHeroSearchQuery = (query: string) => {
  const params = new URLSearchParams();
  const normalized = query.trim();
  if (!normalized) return params;

  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let zip: string | undefined;
  let state: string | undefined;
  let towns: string[] = [];

  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (/^\d{5}$/.test(lastPart)) {
      zip = lastPart;
      parts.pop();
    }
  }

  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (/^[A-Za-z]{2}$/.test(lastPart)) {
      state = lastPart.toUpperCase();
      parts.pop();
    }
  }

  if (parts.length > 0) {
    towns = parts;
  }

  if (zip) {
    params.set("zip", zip);
  }
  if (state) {
    params.set("state", state);
  }
  if (towns.length > 0) {
    params.set("towns", towns.join("|"));
  }

  return params;
};

const DCMLSHero = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = parseHeroSearchQuery(searchQuery);
    const queryString = params.toString();
    navigate(queryString ? `/search?${queryString}` : "/search");
  };

  return (
    <section className="relative w-full h-screen bg-[#111317] overflow-hidden flex flex-col">
      {/* Enhanced AAC-style gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#111317] via-[#0f1419] to-[#111317] opacity-95" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#111317] via-transparent to-[#2537ff]/[0.02]" />

      {/* Subtle blue glows for premium feel */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-[#2537ff] opacity-[0.03] blur-[180px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[#059669] opacity-[0.02] blur-[150px] pointer-events-none" />

      {/* DCMLS Logo - Top Left */}
      <div className="absolute top-6 left-6 lg:top-8 lg:left-8 z-20">
        <div className="flex items-center gap-2 shrink-0">
          <img className="w-[34px] h-[34px]" alt="Logo" src="/aac-monogram-green.svg" />
          <span className="font-extrabold text-white text-xl tracking-[-0.8px] [font-family:'Manrope',Helvetica] whitespace-nowrap leading-none">
            Direct Connect MLS
          </span>
        </div>
      </div>

      {/* Hero content - Full viewport centering */}
      <div className="relative z-10 flex items-center justify-center flex-1 px-6 lg:px-[100px] max-w-[1440px] mx-auto w-full">
        <div className="max-w-[720px] mx-auto flex flex-col gap-10 text-center">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-[#ffffff0d] border border-[#ffffff1a] rounded-full w-fit mx-auto">
            <span className="w-[8px] h-[8px] rounded-full bg-[#059669] shrink-0" />
            <span className="[font-family:'Manrope',Helvetica] font-semibold text-[#ffffffcc] text-sm tracking-[0.28px] uppercase">
              Pre-Market Access
            </span>
          </div>

          {/* Enhanced Headline */}
          <h1
            className="[font-family:'Manrope',Helvetica] font-extrabold text-white text-[clamp(48px,6vw,80px)] tracking-[-2.5px] leading-[1.02] text-center"
            style={{ textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
          >
            See Homes Before They Hit the Market
          </h1>

          {/* Subtext */}
          <p className="[font-family:'Manrope',Helvetica] font-medium text-[#ffffff80] text-[20px] leading-[1.6] text-center max-w-[580px] mx-auto">
            Search public, pre-market, and coming soon homes in one place. Connect directly with agents already working with buyers.
          </p>

          {/* Search Module */}
          <div className="max-w-[640px] mx-auto w-full">
            <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-2xl p-3 flex items-center gap-3">
              <Input
                type="text"
                placeholder="City, Neighborhood, Address, ZIP"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border-0 shadow-none text-base placeholder:text-muted-foreground focus-visible:ring-0"
              />
              <Button
                type="submit"
                size="lg"
                className="bg-[#111317] hover:bg-[#1a1d23] text-white px-8 rounded-xl font-semibold h-12"
              >
                <Search className="w-5 h-5 mr-2" />
                Search
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Enhanced scroll transition fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
    </section>
  );
};

export default DCMLSHero;