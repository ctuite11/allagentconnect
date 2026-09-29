import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import DcmlsBrandLogo from "@/components/dcmls/DcmlsBrandLogo";
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
      {/* Lighter overlay — Compass keeps the photo readable behind white type */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent"
        aria-hidden
      />

      <header className="relative z-20">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-5 sm:h-[3.75rem] sm:px-8 lg:px-12">
          <DcmlsBrandLogo variant="onDark" monogramClassName="h-6 w-6 sm:h-7 sm:w-7" />

          <nav className="hidden items-center gap-6 lg:gap-8 md:flex" aria-label="Primary">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="font-['Manrope'] text-[12px] font-medium tracking-[0.01em] text-white/95 transition-opacity hover:opacity-70 sm:text-[13px]"
              >
                {item.label}
              </Link>
            ))}
            {isDcmlsAuthAccessEnabled() ? (
              <>
                <span className="h-3.5 w-px bg-white/40" aria-hidden />
                <Link
                  to="/consumer/auth?mode=signin"
                  className="font-['Manrope'] text-[12px] font-medium text-white/95 transition-opacity hover:opacity-70 sm:text-[13px]"
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
                  <Button key={item.to} asChild variant="ghost" className="justify-start font-['Manrope']">
                    <Link to={item.to}>{item.label}</Link>
                  </Button>
                ))}
                {isDcmlsAuthAccessEnabled() ? (
                  <Button asChild variant="outline" className="mt-3 justify-start font-['Manrope']">
                    <Link to="/consumer/auth?mode=signin">Register / Sign In</Link>
                  </Button>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Center stack — Compass proportions: ~52–60px title, ~20–22px sub, wide search */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3.75rem)] w-full max-w-[760px] flex-col items-center justify-center px-5 pb-28 pt-6 text-center sm:px-8">
        <h1
          className="animate-[dcmls-fade-up_0.9s_ease-out_both] font-['Manrope'] text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-[3.25rem] md:text-[3.5rem]"
          style={{ textShadow: "0 2px 14px rgba(0,0,0,0.35)" }}
        >
          Find it First
        </h1>
        <p
          className="mt-3 animate-[dcmls-fade-up_0.9s_ease-out_0.12s_both] font-['Manrope'] text-[1.125rem] font-medium leading-snug text-white sm:mt-3.5 sm:text-[1.25rem] md:text-[1.375rem]"
          style={{ textShadow: "0 1px 10px rgba(0,0,0,0.4)" }}
        >
          See more homes.
        </p>

        <div className="mt-7 w-full max-w-[680px] animate-[dcmls-fade-up_0.9s_ease-out_0.22s_both] sm:mt-8">
          <div className="mb-0 flex items-end gap-1" role="tablist" aria-label="Search type">
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
                      ? "rounded-t-[3px] bg-white px-3.5 py-1.5 font-['Manrope'] text-[12px] font-semibold text-neutral-900 sm:px-4 sm:text-[13px]"
                      : "rounded-t-[3px] bg-white/70 px-3.5 py-1.5 font-['Manrope'] text-[12px] font-semibold text-neutral-700 transition-colors hover:bg-white/85 sm:px-4 sm:text-[13px]"
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={handleSearch}
            className="flex h-12 overflow-hidden rounded-b-[3px] rounded-tr-[3px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.28)] sm:h-[52px]"
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
              className="min-w-0 flex-1 border-0 bg-transparent px-4 font-['Manrope'] text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400 sm:px-5 sm:text-[15px]"
            />
            <button
              type="submit"
              aria-label="Search listings"
              className="flex h-full w-12 shrink-0 items-center justify-center bg-neutral-950 text-white transition-colors hover:bg-neutral-800 sm:w-[52px]"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default DcmlsHomeHero;
