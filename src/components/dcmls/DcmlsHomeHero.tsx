import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { isDcmlsAuthAccessEnabled } from "@/lib/dcmlsAuthAccess";

type SearchMode = "buy" | "rent";

const HERO_IMAGE = "/images/dcmls/hero-house.jpg";

const NAV_LINKS = [
  { label: "Buy", to: "/browse?dcmls=1&lt=for_sale" },
  { label: "Rent", to: "/browse?dcmls=1&lt=for_rent" },
  { label: "Browse", to: "/browse?dcmls=1" },
  { label: "Our Agents", to: "/our-agents" },
] as const;

function parseHeroSearchQuery(query: string) {
  const params = new URLSearchParams();
  params.set("dcmls", "1");
  const normalized = query.trim();
  if (!normalized) return params;

  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let zip: string | undefined;
  let state: string | undefined;
  const towns: string[] = [];

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
    towns.push(...parts);
  } else if (!zip && !state && /^\d{5}$/.test(normalized)) {
    zip = normalized;
  } else if (!zip && !state) {
    towns.push(normalized);
  }

  if (zip) params.set("zip", zip);
  if (state) params.set("state", state);
  if (towns.length > 0) params.set("towns", towns.join("|"));

  return params;
}

const DcmlsHomeHero: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SearchMode>("buy");
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = parseHeroSearchQuery(query);
    params.set("lt", mode === "rent" ? "for_rent" : "for_sale");
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-neutral-900 text-white">
      <img
        src={HERO_IMAGE}
        alt=""
        className="absolute inset-0 h-full w-full object-cover scale-105 animate-[dcmls-hero-zoom_18s_ease-out_forwards]"
        fetchPriority="high"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/50"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white to-transparent"
        aria-hidden
      />

      <header className="relative z-20">
        <div className="mx-auto flex h-[4.25rem] max-w-[1200px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link
            to="/"
            className="font-['Manrope'] text-[15px] font-semibold tracking-[0.18em] text-white sm:text-base"
          >
            DIRECT CONNECT MLS
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="font-['Manrope'] text-[13px] font-medium text-white/90 transition-opacity hover:opacity-70"
              >
                {item.label}
              </Link>
            ))}
            {isDcmlsAuthAccessEnabled() ? (
              <>
                <span className="h-4 w-px bg-white/35" aria-hidden />
                <Link
                  to="/consumer/auth?mode=signin"
                  className="font-['Manrope'] text-[13px] font-medium text-white/90 transition-opacity hover:opacity-70"
                >
                  Register / Sign In
                </Link>
              </>
            ) : null}
          </nav>

          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open menu"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-8 flex flex-col gap-1">
                {NAV_LINKS.map((item) => (
                  <Button key={item.to} asChild variant="ghost" className="justify-start">
                    <Link to={item.to}>{item.label}</Link>
                  </Button>
                ))}
                {isDcmlsAuthAccessEnabled() ? (
                  <Button asChild variant="outline" className="mt-3 justify-start">
                    <Link to="/consumer/auth?mode=signin">Register / Sign In</Link>
                  </Button>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4.25rem)] max-w-[760px] flex-col items-center justify-center px-5 pb-24 pt-10 text-center sm:px-8">
        <h1 className="animate-[dcmls-fade-up_0.9s_ease-out_both] font-['Instrument_Serif'] text-[clamp(2.5rem,7vw,4.75rem)] font-normal leading-[1.05] tracking-[-0.02em] text-white">
          Search on Direct Connect
        </h1>
        <p className="mt-4 animate-[dcmls-fade-up_0.9s_ease-out_0.12s_both] font-['Manrope'] text-base font-medium text-white/90 sm:text-lg">
          Find more homes.
        </p>

        <div className="mt-9 w-full max-w-[640px] animate-[dcmls-fade-up_0.9s_ease-out_0.22s_both]">
          <div className="mb-0 flex items-end gap-1.5 px-0.5" role="tablist" aria-label="Search type">
            {(
              [
                { id: "buy", label: "Buy" },
                { id: "rent", label: "Rent" },
              ] as const
            ).map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(tab.id)}
                  className={
                    active
                      ? "rounded-t-md bg-white px-4 py-2 font-['Manrope'] text-[13px] font-semibold text-neutral-900"
                      : "rounded-t-md bg-white/55 px-4 py-2 font-['Manrope'] text-[13px] font-semibold text-neutral-800 backdrop-blur-sm transition-colors hover:bg-white/75"
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={handleSearch}
            className="flex overflow-hidden rounded-b-md rounded-tr-md bg-white shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
          >
            <label className="sr-only" htmlFor="dcmls-hero-search">
              Search location
            </label>
            <input
              id="dcmls-hero-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="City, Neighborhood, Address, ZIP"
              className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3.5 font-['Manrope'] text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 sm:px-5 sm:py-4"
            />
            <button
              type="submit"
              aria-label="Search listings"
              className="flex h-auto w-12 shrink-0 items-center justify-center bg-neutral-950 text-white transition-colors hover:bg-neutral-800 sm:w-14"
            >
              <Search className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default DcmlsHomeHero;
